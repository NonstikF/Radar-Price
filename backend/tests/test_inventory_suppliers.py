"""Inventory management enabled per supplier: stock, locations and reports."""
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.update(
    DATABASE_URL="postgresql+asyncpg://test:test@127.0.0.1:1/test",
    PROJECT_NAME="inventory-test",
    SECRET_KEY="isolated-test-key",
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="15",
)

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.api.endpoints.invoices import (
    ManualProductSchema, create_manual, delete_batch, get_batch_items, get_products, upload_invoice,
)
from app.api.endpoints.locations import (
    AddProductToLocation, add_product_to_location, get_location_detail, get_locations,
    search_products_for_location,
)
from app.api.endpoints.reports import get_inventory_summary, get_stock_history
from app.api.endpoints.suppliers import InventoryToggle, get_suppliers, set_supplier_inventory
from app.domain.models import (
    Base, ImportBatch, ImportBatchItem, Location, Product, ProductLocation, StockHistory, Supplier,
)

MANAGED, UNMANAGED = 1, 2

INVOICE = b"""<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4">
  <cfdi:Emisor Rfc="{rfc}" Nombre="Proveedor"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Descripcion="Maceta existente" Cantidad="4" ValorUnitario="10" Importe="40"/>
    <cfdi:Concepto Descripcion="Maceta nueva" Cantidad="6" ValorUnitario="5" Importe="30"/>
  </cfdi:Conceptos>
</cfdi:Comprobante>"""


class AsyncSessionAdapter:
    """Use SQLite's built-in driver with the async endpoint interface."""
    def __init__(self, session):
        self.session = session

    async def get(self, model, key):
        return self.session.get(model, key)

    async def execute(self, statement):
        return self.session.execute(statement)

    def add(self, obj):
        self.session.add(obj)

    def add_all(self, objs):
        self.session.add_all(objs)

    async def flush(self):
        self.session.flush()

    async def delete(self, obj):
        self.session.delete(obj)

    async def refresh(self, obj):
        self.session.refresh(obj)

    async def commit(self):
        self.session.commit()

    async def rollback(self):
        self.session.rollback()


class FakeUpload:
    def __init__(self, filename, content):
        self.filename = filename
        self.content_type = "application/xml"
        self.content = content

    async def read(self):
        return self.content


class InventoryBySupplierTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.directory.name) / 'inventory.db'}")
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            session.add_all([
                Supplier(id=MANAGED, name="Con inventario", rfc="AAA010101AAA", manages_inventory=True),
                Supplier(id=UNMANAGED, name="Sin inventario", rfc="BBB010101BBB"),
                Product(id=1, name="Gestionado", supplier_id=MANAGED, stock_quantity=5, price=10),
                Product(id=2, name="No gestionado", supplier_id=UNMANAGED, stock_quantity=7, price=10),
                Product(id=3, name="Sin proveedor", stock_quantity=9, price=10),
                Location(id=1, code="R1B1"),
                ProductLocation(location_id=1, product_id=1, quantity=2),
                ProductLocation(location_id=1, product_id=2, quantity=3),
                StockHistory(product_id=1, change_type="AJUSTE", old_value=0, new_value=5),
                StockHistory(product_id=2, change_type="AJUSTE", old_value=0, new_value=7),
            ])
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.directory.cleanup()

    async def call(self, endpoint, *args, **kwargs):
        with Session(self.engine) as session:
            return await endpoint(*args, db=AsyncSessionAdapter(session), **kwargs)

    def stock(self):
        with Session(self.engine) as session:
            return {p.name: p.stock_quantity for p in session.query(Product).all()}

    async def test_new_suppliers_start_without_inventory_and_admin_can_toggle_it(self):
        suppliers = {s["id"]: s["manages_inventory"] for s in await self.call(get_suppliers)}
        self.assertEqual(suppliers, {MANAGED: True, UNMANAGED: False})
        await self.call(set_supplier_inventory, UNMANAGED, InventoryToggle(enabled=True))
        suppliers = {s["id"]: s["manages_inventory"] for s in await self.call(get_suppliers)}
        self.assertEqual(suppliers[UNMANAGED], True)

    async def test_stock_is_hidden_for_products_outside_inventory(self):
        result = await self.call(get_products, sort_by="id", sort_order="asc")
        self.assertEqual({i["id"]: i["stock"] for i in result["items"]}, {1: 5, 2: None, 3: None})
        low = await self.call(get_products, min_stock=100, sort_by="id", sort_order="asc")
        self.assertEqual([i["id"] for i in low["items"]], [1])

    async def test_warehouse_filter_only_lists_managed_products_with_stock(self):
        with Session(self.engine) as session:
            session.add(Product(id=4, name="Agotado", supplier_id=MANAGED, stock_quantity=0))
            session.commit()
        result = await self.call(get_products, in_stock=True, sort_by="id", sort_order="asc")
        self.assertEqual([i["id"] for i in result["items"]], [1])
        self.assertEqual(result["total"], 1)

    async def upload_and_delete(self, supplier_id, rfc):
        """Sube la factura, regresa el stock resultante y el que queda al borrarla."""
        with Session(self.engine) as session:
            session.get(Product, 1).name = "Maceta existente"
            session.get(Product, 1).supplier_id = supplier_id
            session.commit()
        content = INVOICE.replace(b"{rfc}", rfc.encode())
        result = await self.call(upload_invoice, FakeUpload("factura.xml", content))
        after_upload = self.stock()
        await self.call(delete_batch, result["batch_id"])
        after_delete = self.stock()
        pick = lambda s: (s["Maceta existente"], s["Maceta nueva"])
        return pick(after_upload), pick(after_delete)

    async def test_invoice_adds_and_reverts_stock_for_managed_supplier(self):
        uploaded, deleted = await self.upload_and_delete(MANAGED, "AAA010101AAA")
        self.assertEqual(uploaded, (9, 6))
        self.assertEqual(deleted, (5, 0))

    async def test_invoice_leaves_stock_alone_for_unmanaged_supplier(self):
        uploaded, deleted = await self.upload_and_delete(UNMANAGED, "BBB010101BBB")
        self.assertEqual(uploaded, (5, 0))
        # Borrar la factura no resta lo que nunca se sumó
        self.assertEqual(deleted, (5, 0))

    async def test_batch_items_hide_stock_outside_inventory(self):
        with Session(self.engine) as session:
            session.add_all([
                ImportBatch(id=1, filename="factura.xml"),
                ImportBatchItem(batch_id=1, product_id=1, quantity=1),
                ImportBatchItem(batch_id=1, product_id=2, quantity=1, stock_applied=False),
            ])
            session.commit()
        items = await self.call(get_batch_items, 1)
        self.assertEqual({i["id"]: i["stock"] for i in items}, {1: 5, 2: None})

    async def test_manual_product_only_keeps_stock_with_managed_supplier(self):
        for supplier_id, expected in [(MANAGED, 3), (UNMANAGED, 0), (None, 0)]:
            with self.subTest(supplier_id=supplier_id):
                name = f"Manual {supplier_id}"
                await self.call(create_manual, ManualProductSchema(name=name, stock=3, supplier_id=supplier_id))
                self.assertEqual(self.stock()[name], expected)

    async def test_locations_only_show_and_accept_managed_products(self):
        locations = await self.call(get_locations)
        self.assertEqual(locations[0]["product_count"], 1)
        detail = await self.call(get_location_detail, 1)
        self.assertEqual([p["product_id"] for p in detail["products"]], [1])
        found = await self.call(search_products_for_location, q=None, location_id=None, with_locations=False)
        self.assertEqual([p["id"] for p in found], [1])

        with self.assertRaises(HTTPException) as error:
            await self.call(add_product_to_location, 1, AddProductToLocation(product_id=3, quantity=1))
        self.assertEqual(error.exception.status_code, 400)
        await self.call(add_product_to_location, 1, AddProductToLocation(product_id=1, quantity=1))

    async def test_reports_only_count_managed_products(self):
        summary = await self.call(get_inventory_summary)
        self.assertEqual(summary["total_products"], 1)
        self.assertEqual(summary["cost_value"], 50)
        history = await self.call(get_stock_history)
        self.assertEqual([i["product_id"] for i in history["items"]], [1])


if __name__ == "__main__":
    unittest.main()
