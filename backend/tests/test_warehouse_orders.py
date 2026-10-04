"""Warehouse orders: pieces live in locations, orders reserve them and fulfilling takes them off the shelves."""
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
    AddItemRequest, FulfillRequest, PickRequest, UpdateItemRequest, UpdateStatusRequest, add_item_to_list,
    delete_item, delete_shopping_list, fulfill_list, get_shopping_list, update_item, update_status,
)
from app.api.endpoints.locations import (
    AddProductToLocation, MoveProduct, UpdateQuantity, add_product_to_location, move_product,
    remove_product_from_location, update_product_quantity,
)
from app.api.endpoints.stock import get_stock
from app.domain.models import (
    Base, Location, Product, ProductLocation, ShoppingList, ShoppingListItem, StockHistory, Supplier,
)
from app.services.inventory import UNLOCATED_CODE, reconcile_stock

MANAGED, UNMANAGED = 1, 2
PRODUCT, OTHER, OUTSIDE = 1, 2, 3
SHELF, OTHER_SHELF = 1, 2


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
                Location(id=SHELF, code="R1B1"),
                Location(id=OTHER_SHELF, code="R2B1"),
                ProductLocation(location_id=SHELF, product_id=PRODUCT, quantity=10),
                ProductLocation(location_id=SHELF, product_id=OTHER, quantity=4),
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

    async def fulfill(self, list_id, *picks):
        request = FulfillRequest(picks=[
            PickRequest(item_id=item_id, location_id=location_id, quantity=quantity)
            for item_id, location_id, quantity in picks
        ])
        return await self.call(fulfill_list, list_id, request)

    def stock(self, product_id=PRODUCT):
        with Session(self.engine) as session:
            return session.get(Product, product_id).stock_quantity

    def shelves(self, product_id=PRODUCT):
        with Session(self.engine) as session:
            rows = session.query(ProductLocation).filter_by(product_id=product_id).all()
            return {row.location.code: row.quantity for row in rows}

    def item_id(self, product_id=PRODUCT):
        with Session(self.engine) as session:
            return session.query(ShoppingListItem).filter_by(product_id=product_id).one().id

    def moves(self):
        with Session(self.engine) as session:
            return [(h.change_type, h.old_value, h.new_value, h.source) for h in session.query(StockHistory).all()]

    async def assert_rejected(self, coro, fragment):
        with self.assertRaises(HTTPException) as error:
            await coro
        self.assertEqual(error.exception.status_code, 400)
        self.assertIn(fragment, error.exception.detail)

    async def test_ordering_reserves_stock_and_records_the_movement(self):
        result = await self.order(PRODUCT, 3)
        await self.order(PRODUCT, 2)
        self.assertEqual(self.stock(), 5)
        self.assertEqual(self.shelves(), {"R1B1": 10})  # siguen en el estante hasta surtir
        detail = await self.call(get_shopping_list, result["list_id"])
        item = detail["items"][0]
        self.assertEqual((item["quantity"], item["max_quantity"], item["to_pick"]), (5, 10, 5))
        self.assertEqual(item["locations"], [{"location_id": SHELF, "code": "R1B1", "quantity": 10}])
        self.assertEqual([m[:3] for m in self.moves()], [("PEDIDO", 10, 7), ("PEDIDO", 7, 5)])

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
        self.assertEqual(self.moves(), [])

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
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        self.assertEqual(self.stock(), 10)
        await self.call(update_status, list_id, UpdateStatusRequest(status="active"))
        self.assertEqual(self.stock(), 4)

    async def test_reactivating_fails_when_the_stock_was_taken_meanwhile(self):
        list_id = (await self.order(OTHER, 3))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        await self.call(update_product_quantity, SHELF, OTHER, UpdateQuantity(quantity=1))
        await self.assert_rejected(
            self.call(update_status, list_id, UpdateStatusRequest(status="active")), "máximo para este pedido es 1")
        self.assertEqual(self.stock(OTHER), 1)

    async def test_only_one_active_order_per_supplier(self):
        list_id = (await self.order(OTHER, 3))["list_id"]
        await self.call(update_status, list_id, UpdateStatusRequest(status="cancelled"))
        await self.order(OTHER, 2)  # abre un pedido activo nuevo
        await self.assert_rejected(
            self.call(update_status, list_id, UpdateStatusRequest(status="active")), "Ya hay un pedido activo")

    async def test_fulfilling_takes_the_pieces_from_the_chosen_shelves(self):
        await self.call(add_product_to_location, OTHER_SHELF, AddProductToLocation(product_id=PRODUCT, quantity=5))
        list_id = (await self.order(PRODUCT, 7))["list_id"]
        item_id = self.item_id()
        self.assertEqual(self.stock(), 8)

        await self.assert_rejected(self.fulfill(list_id, (item_id, SHELF, 5)), "las 7 piezas de Maceta (llevas 5)")
        await self.assert_rejected(self.fulfill(list_id, (item_id, OTHER_SHELF, 7)), "En R2B1 solo hay 5 piezas")
        await self.fulfill(list_id, (item_id, SHELF, 5), (item_id, OTHER_SHELF, 2))

        self.assertEqual(self.shelves(), {"R1B1": 5, "R2B1": 3})
        self.assertEqual(self.stock(), 8)  # lo apartado ya no estaba disponible
        detail = await self.call(get_shopping_list, list_id)
        self.assertEqual(detail["status"], "completed")
        self.assertEqual(detail["items"][0]["picks"], [{"code": "R1B1", "quantity": 5}, {"code": "R2B1", "quantity": 2}])

    async def test_warehouse_orders_are_fulfilled_only_through_fulfill(self):
        list_id = (await self.order(PRODUCT, 2))["list_id"]
        await self.assert_rejected(
            self.call(update_status, list_id, UpdateStatusRequest(status="completed")), "Surtir pedido")
        await self.fulfill(list_id, (self.item_id(), SHELF, 2))
        for status in ("active", "cancelled"):
            with self.subTest(status=status):
                await self.assert_rejected(
                    self.call(update_status, list_id, UpdateStatusRequest(status=status)), "ya se surtió")
        await self.assert_rejected(self.fulfill(list_id), "Solo se surten pedidos activos")
        await self.assert_rejected(
            self.call(update_item, list_id, self.item_id(), UpdateItemRequest(quantity=3)), "pedidos activos")

    async def test_deleting_an_active_order_returns_its_pieces_but_a_delivered_one_does_not(self):
        list_id = (await self.order(PRODUCT, 3))["list_id"]
        await self.call(delete_shopping_list, list_id)
        self.assertEqual(self.stock(), 10)
        list_id = (await self.order(PRODUCT, 3))["list_id"]
        await self.fulfill(list_id, (self.item_id(), SHELF, 3))
        await self.call(delete_shopping_list, list_id)
        self.assertEqual((self.stock(), self.shelves()), (7, {"R1B1": 7}))

    async def test_old_lists_without_deductions_do_not_return_stock(self):
        with Session(self.engine) as session:
            session.add_all([
                ShoppingList(id=50, supplier_id=MANAGED, status="active"),
                ShoppingListItem(list_id=50, product_id=PRODUCT, quantity=5),
            ])
            session.commit()
        await self.call(update_status, 50, UpdateStatusRequest(status="cancelled"))
        self.assertEqual(self.stock(), 10)

    async def test_location_quantities_move_product_stock(self):
        await self.call(add_product_to_location, OTHER_SHELF, AddProductToLocation(product_id=OTHER, quantity=6))
        self.assertEqual(self.stock(OTHER), 10)
        await self.call(update_product_quantity, OTHER_SHELF, OTHER, UpdateQuantity(quantity=2))
        self.assertEqual(self.stock(OTHER), 6)
        await self.call(remove_product_from_location, OTHER_SHELF, OTHER)
        self.assertEqual(self.stock(OTHER), 4)
        self.assertEqual(self.moves(), [
            ("ENTRADA", 4, 10, "ubicación R2B1"), ("SALIDA", 10, 6, "ubicación R2B1"),
            ("SALIDA", 6, 4, "ubicación R2B1"),
        ])

    async def test_moving_between_shelves_keeps_the_stock(self):
        await self.call(move_product, MoveProduct(product_id=OTHER, from_location_id=SHELF, to_location_id=OTHER_SHELF, quantity=3))
        self.assertEqual((self.stock(OTHER), self.shelves(OTHER)), (4, {"R1B1": 1, "R2B1": 3}))
        # Mover todo lo que queda saca el producto del estante de origen
        await self.call(move_product, MoveProduct(product_id=OTHER, from_location_id=SHELF, to_location_id=OTHER_SHELF, quantity=1))
        self.assertEqual(self.shelves(OTHER), {"R2B1": 4})
        await self.assert_rejected(
            self.call(move_product, MoveProduct(product_id=OTHER, from_location_id=OTHER_SHELF, to_location_id=SHELF, quantity=5)),
            "En R2B1 solo hay 4 piezas")
        self.assertEqual(self.moves(), [])

    async def test_shelves_cannot_drop_below_the_reserved_pieces(self):
        await self.order(OTHER, 3)
        await self.assert_rejected(
            self.call(update_product_quantity, SHELF, OTHER, UpdateQuantity(quantity=2)),
            "3 piezas de Tierra están apartadas en pedidos activos: solo puedes quitar 1")
        await self.call(update_product_quantity, SHELF, OTHER, UpdateQuantity(quantity=3))
        self.assertEqual(self.stock(OTHER), 0)

    async def test_reconcile_keeps_unshelved_stock_and_trusts_the_shelves(self):
        with Session(self.engine) as session:
            session.get(Product, PRODUCT).stock_quantity = 13  # 3 sin estante
            session.get(Product, OTHER).stock_quantity = 2     # el estante dice 4
            session.commit()
        with Session(self.engine) as session:
            self.assertEqual(await reconcile_stock(AsyncSessionAdapter(session)), 2)
            session.commit()
        self.assertEqual((self.stock(), self.shelves()), (13, {"R1B1": 10, UNLOCATED_CODE: 3}))
        self.assertEqual((self.stock(OTHER), self.shelves(OTHER)), (4, {"R1B1": 4}))
        with Session(self.engine) as session:
            self.assertEqual(await reconcile_stock(AsyncSessionAdapter(session)), 0)

    async def test_stock_list_only_shows_warehouse_products(self):
        with Session(self.engine) as session:
            session.add(Product(id=4, name="Agotada", supplier_id=MANAGED, stock_quantity=0))
            session.commit()
        await self.order(PRODUCT, 2)
        result = await self.call(get_stock, q=None)
        self.assertEqual([(i["name"], i["stock"], i["reserved"]) for i in result["items"]],
                         [("Agotada", 0, 0), ("Maceta", 8, 2), ("Tierra", 4, 0)])
        self.assertEqual(result["items"][1]["locations"], [{"location_id": SHELF, "code": "R1B1", "quantity": 10}])
        for availability, expected in [("in", ["Maceta", "Tierra"]), ("out", ["Agotada"])]:
            with self.subTest(availability=availability):
                result = await self.call(get_stock, q=None, availability=availability)
                self.assertEqual([i["name"] for i in result["items"]], expected)


if __name__ == "__main__":
    unittest.main()
