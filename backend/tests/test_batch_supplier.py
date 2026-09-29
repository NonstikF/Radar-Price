"""Invoice-level supplier assignment and the search supplier filter."""
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.update(
    DATABASE_URL="postgresql+asyncpg://test:test@127.0.0.1:1/test",
    PROJECT_NAME="supplier-test",
    SECRET_KEY="isolated-test-key",
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="15",
)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.api.endpoints.invoices import (
    BatchSupplierSchema, get_batch, get_batch_items, get_products, set_batch_supplier,
)
from app.domain.models import Base, ImportBatch, ImportBatchItem, Product, Supplier


class AsyncSessionAdapter:
    """Use SQLite's built-in driver with the async endpoint interface."""
    def __init__(self, session):
        self.session = session

    async def get(self, model, key):
        return self.session.get(model, key)

    async def execute(self, statement):
        return self.session.execute(statement)

    async def commit(self):
        self.session.commit()


class BatchSupplierTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.directory.name) / 'suppliers.db'}")
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            session.add_all([
                Supplier(id=1, name="Vivero Norte"),
                Supplier(id=2, name="Vivero Sur"),
                Product(id=1, name="Con proveedor", supplier_id=1),
                Product(id=2, name="Sin proveedor"),
                Product(id=3, name="Fuera de la factura"),
                ImportBatch(id=1, filename="factura.xml"),
                ImportBatchItem(batch_id=1, product_id=1, quantity=2),
                ImportBatchItem(batch_id=1, product_id=2, quantity=3),
            ])
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.directory.cleanup()

    async def assign(self, supplier_id, overwrite):
        with Session(self.engine) as session:
            return await set_batch_supplier(
                1, BatchSupplierSchema(supplier_id=supplier_id, overwrite=overwrite),
                AsyncSessionAdapter(session),
            )

    def suppliers(self):
        with Session(self.engine) as session:
            return {p.id: p.supplier_id for p in session.query(Product).all()}

    async def test_fill_only_touches_products_without_supplier(self):
        result = await self.assign(2, overwrite=False)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(self.suppliers(), {1: 1, 2: 2, 3: None})
        with Session(self.engine) as session:
            batch = await get_batch(1, AsyncSessionAdapter(session))
            self.assertEqual((batch["supplier_id"], batch["supplier_name"]), (2, "Vivero Sur"))
            items = await get_batch_items(1, AsyncSessionAdapter(session))
            self.assertEqual({i["id"]: i["supplier_name"] for i in items},
                             {1: "Vivero Norte", 2: "Vivero Sur"})

    async def test_overwrite_replaces_every_product_in_the_invoice(self):
        result = await self.assign(2, overwrite=True)
        self.assertEqual(result["updated"], 2)
        self.assertEqual(self.suppliers(), {1: 2, 2: 2, 3: None})

    async def test_search_filters_by_supplier_and_by_missing_supplier(self):
        for supplier_id, expected in [(1, [1]), (0, [2, 3]), (None, [1, 2, 3])]:
            with self.subTest(supplier_id=supplier_id):
                with Session(self.engine) as session:
                    result = await get_products(supplier_id=supplier_id, sort_by="id",
                                                sort_order="asc", db=AsyncSessionAdapter(session))
                    self.assertEqual([i["id"] for i in result["items"]], expected)
                    self.assertEqual(result["total"], len(expected))
