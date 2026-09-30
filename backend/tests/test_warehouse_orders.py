"""Warehouse orders: shopping lists deduct stock and never exceed it."""
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.update(
    DATABASE_URL="postgresql+asyncpg://test:test@127.0.0.1:1/test",
    PROJECT_NAME="orders-test",
    SECRET_KEY="isolated-test-key",
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="15",
)

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.api.endpoints.shopping_lists import (
    AddItemRequest, UpdateItemRequest, UpdateStatusRequest, add_item_to_list, delete_item,
    delete_shopping_list, get_shopping_list, update_item, update_status,
)
from app.api.endpoints.locations import (
    AddProductToLocation, UpdateQuantity, add_product_to_location, remove_product_from_location,
    update_product_quantity,
)
from app.api.endpoints.stock import StockAdjust, adjust_stock, get_stock
from app.domain.models import (
    Base, Location, Product, ProductLocation, ShoppingList, ShoppingListItem, StockHistory, Supplier,
)

MANAGED, UNMANAGED = 1, 2
PRODUCT, OTHER, OUTSIDE = 1, 2, 3


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

    async def flush(self):
        self.session.flush()

    async def delete(self, obj):
        self.session.delete(obj)

    async def commit(self):
        self.session.commit()


class WarehouseOrderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.directory.name) / 'orders.db'}")
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            session.add_all([
                Supplier(id=MANAGED, name="Almacén", manages_inventory=True),
                Supplier(id=UNMANAGED, name="Externo"),
                Product(id=PRODUCT, name="Maceta", supplier_id=MANAGED, stock_quantity=10, price=5),
                Product(id=OTHER, name="Tierra", supplier_id=MANAGED, stock_quantity=4, price=5),
                Product(id=OUTSIDE, name="Fertilizante", supplier_id=UNMANAGED, stock_quantity=0, price=5),
            ])
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.directory.cleanup()

    async def call(self, endpoint, *args, **kwargs):
        with Session(self.engine) as session:
            return await endpoint(*args, db=AsyncSessionAdapter(session), **kwargs)

    async def order(self, product_id, quantity):
        return await self.call(add_item_to_list, AddItemRequest(product_id=product_id, quantity=quantity))

    def stock(self, product_id=PRODUCT):
        with Session(self.engine) as session:
            return session.get(Product, product_id).stock_quantity

    def item_id(self, product_id=PRODUCT):
        with Session(self.engine) as session:
            return session.query(ShoppingListItem).filter_by(product_id=product_id).one().id

    async def assert_rejected(self, coro, fragment):
        with self.assertRaises(HTTPException) as error:
            await coro
        self.assertEqual(error.exception.status_code, 400)
        self.assertIn(fragment, error.exception.detail)

    async def test_ordering_deducts_stock_and_records_the_movement(self):
        result = await self.order(PRODUCT, 3)
        await self.order(PRODUCT, 2)
        self.assertEqual(self.stock(), 5)
        detail = await self.call(get_shopping_list, result["list_id"])
        self.assertEqual((detail["items"][0]["quantity"], detail["items"][0]["max_quantity"]), (5, 10))
        with Session(self.engine) as session:
            moves = [(h.change_type, h.old_value, h.new_value) for h in session.query(StockHistory).all()]
        self.assertEqual(moves, [("PEDIDO", 10, 7), ("PEDIDO", 7, 5)])

    async def test_cannot_order_more_than_the_warehouse_has(self):
        await self.assert_rejected(self.order(OTHER, 5), "el máximo para este pedido es 4")
        self.assertEqual(self.stock(OTHER), 4)
        await self.order(OTHER, 4)
        await self.assert_rejected(self.order(OTHER, 1), "el máximo para este pedido es 4")

    async def test_other_suppliers_order_freely_without_touching_stock(self):
        list_id = (await self.order(OUTSIDE, 25))["list_id"]
        self.assertEqual(self.stock(OUTSIDE), 0)
        detail = await self.call(get_shopping_list, list_id)
        self.assertIsNone(detail["items"][0]["max_quantity"])
        # Como siempre: se editan en cualquier estado y cancelar no mueve stock
        await self.call(update_status, list_id, UpdateStatusRequest(status="completed"))
        await self.call(update_item, list_id, self.item_id(OUTSIDE), UpdateItemRequest(quantity=40))
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        self.assertEqual(self.stock(OUTSIDE), 0)
        with Session(self.engine) as session:
            self.assertEqual(session.query(StockHistory).count(), 0)

    async def test_editing_quantities_moves_only_the_difference(self):
        result = await self.order(PRODUCT, 4)
        list_id, item_id = result["list_id"], self.item_id()
        await self.call(update_item, list_id, item_id, UpdateItemRequest(quantity=10))
        self.assertEqual(self.stock(), 0)
        await self.assert_rejected(
            self.call(update_item, list_id, item_id, UpdateItemRequest(quantity=11)), "máximo para este pedido es 10")
        await self.call(update_item, list_id, item_id, UpdateItemRequest(quantity=2))
        self.assertEqual(self.stock(), 8)
        await self.call(delete_item, list_id, item_id)
        self.assertEqual(self.stock(), 10)

    async def test_cancel_returns_pieces_and_reactivating_takes_them_again(self):
        list_id = (await self.order(PRODUCT, 6))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="completed"))
        self.assertEqual(self.stock(), 4)  # surtir no mueve stock
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        self.assertEqual(self.stock(), 10)
        await self.call(update_status, list_id, UpdateStatusRequest(status="active"))
        self.assertEqual(self.stock(), 4)

    async def test_reactivating_fails_when_the_stock_was_taken_meanwhile(self):
        list_id = (await self.order(OTHER, 3))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        await self.call(adjust_stock, OTHER, StockAdjust(mode="set", quantity=1))
        await self.assert_rejected(
            self.call(update_status, list_id, UpdateStatusRequest(status="active")), "máximo para este pedido es 1")
        self.assertEqual(self.stock(OTHER), 1)

    async def test_only_one_active_order_per_supplier(self):
        list_id = (await self.order(OTHER, 3))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        await self.order(OTHER, 2)  # abre un pedido activo nuevo
        await self.assert_rejected(
            self.call(update_status, list_id, UpdateStatusRequest(status="active")), "Ya hay un pedido activo")

    async def test_only_active_orders_can_be_edited(self):
        list_id = (await self.order(PRODUCT, 1))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="completed"))
        await self.assert_rejected(
            self.call(update_item, list_id, self.item_id(), UpdateItemRequest(quantity=3)), "pedidos activos")

    async def test_deleting_an_active_order_returns_its_pieces_but_a_delivered_one_does_not(self):
        list_id = (await self.order(PRODUCT, 3))["list_id"]
        await self.call(delete_shopping_list, list_id)
        self.assertEqual(self.stock(), 10)
        list_id = (await self.order(PRODUCT, 3))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="completed"))
        await self.call(delete_shopping_list, list_id)
        self.assertEqual(self.stock(), 7)

    async def test_old_lists_without_deductions_do_not_return_stock(self):
        with Session(self.engine) as session:
            session.add_all([
                ShoppingList(id=50, supplier_id=MANAGED, status="active"),
                ShoppingListItem(list_id=50, product_id=PRODUCT, quantity=5),
            ])
            session.commit()
        await self.call(update_status, 50, UpdateStatusRequest(status="cancelled"))
        self.assertEqual(self.stock(), 10)

    async def test_manual_adjustments(self):
        await self.call(adjust_stock, PRODUCT, StockAdjust(mode="set", quantity=7, note="Conteo"))
        await self.call(adjust_stock, PRODUCT, StockAdjust(mode="add", quantity=3))
        await self.call(adjust_stock, PRODUCT, StockAdjust(mode="subtract", quantity=2, note="Merma"))
        self.assertEqual(self.stock(), 8)
        await self.assert_rejected(
            self.call(adjust_stock, PRODUCT, StockAdjust(mode="subtract", quantity=9)), "Solo hay 8 piezas")
        await self.assert_rejected(
            self.call(adjust_stock, OUTSIDE, StockAdjust(mode="add", quantity=1)), "no tiene gestión de inventario")
        with Session(self.engine) as session:
            moves = [(h.change_type, h.source) for h in session.query(StockHistory).all()]
        self.assertEqual(moves, [("AJUSTE", "Conteo"), ("ENTRADA", "manual"), ("SALIDA", "Merma")])

    async def test_location_quantities_move_product_stock(self):
        with Session(self.engine) as session:
            session.add_all([Location(id=1, code="R1B1"), Location(id=2, code="R2B1")])
            session.commit()
        await self.call(add_product_to_location, 1, AddProductToLocation(product_id=OTHER, quantity=6))
        self.assertEqual(self.stock(OTHER), 10)
        await self.call(update_product_quantity, 1, OTHER, UpdateQuantity(quantity=2))
        self.assertEqual(self.stock(OTHER), 6)
        # Mover entre ubicaciones: quitar de una y agregar en otra queda en cero
        await self.call(remove_product_from_location, 1, OTHER)
        await self.call(add_product_to_location, 2, AddProductToLocation(product_id=OTHER, quantity=2))
        self.assertEqual(self.stock(OTHER), 6)
        with Session(self.engine) as session:
            moves = [(h.change_type, h.source) for h in session.query(StockHistory).all()]
        self.assertEqual(moves, [
            ("ENTRADA", "ubicación R1B1"), ("AJUSTE", "ubicación R1B1"),
            ("SALIDA", "ubicación R1B1"), ("ENTRADA", "ubicación R2B1"),
        ])

    async def test_stock_list_only_shows_warehouse_products(self):
        with Session(self.engine) as session:
            session.add_all([
                Location(id=1, code="R1B2"),
                ProductLocation(location_id=1, product_id=PRODUCT, quantity=6),
                Product(id=4, name="Agotada", supplier_id=MANAGED, stock_quantity=0),
            ])
            session.commit()
        result = await self.call(get_stock, q=None)
        self.assertEqual([(i["name"], i["stock"]) for i in result["items"]],
                         [("Agotada", 0), ("Maceta", 10), ("Tierra", 4)])
        self.assertEqual(result["items"][1]["locations"], [{"code": "R1B2", "quantity": 6}])
        for availability, expected in [("in", ["Maceta", "Tierra"]), ("out", ["Agotada"])]:
            with self.subTest(availability=availability):
                result = await self.call(get_stock, q=None, availability=availability)
                self.assertEqual([i["name"] for i in result["items"]], expected)


if __name__ == "__main__":
    unittest.main()
