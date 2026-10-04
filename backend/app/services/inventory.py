from typing import Dict, Iterable, Optional, Set

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.domain.models import (
    Location, Product, ProductLocation, ShoppingList, ShoppingListItem, StockHistory, Supplier,
)

# Solo los productos de proveedores con gestión de inventario llevan stock,
# ubicaciones y reportes de inventario. Un producto sin proveedor queda fuera.
#
# Las piezas físicas viven en las ubicaciones. La existencia del producto
# (stock_quantity) es lo disponible: lo que hay en ubicaciones menos lo
# apartado por pedidos activos. Surtir un pedido saca las piezas de los
# estantes que indica quien surte, así que la existencia no cambia.

INVENTORY_DISABLED_MESSAGE = (
    "El proveedor de este producto no tiene gestión de inventario. "
    "Actívala en Configuración."
)

# Ubicación a donde va, al conciliar, la existencia que no tenía estante.
UNLOCATED_CODE = "SINUBICAR"


def managed_supplier_ids():
    """Subconsulta con los IDs de proveedores que gestionan inventario."""
    return select(Supplier.id).where(Supplier.manages_inventory.is_(True))


def product_in_inventory():
    """Condición SQL: el producto es de un proveedor con gestión de inventario."""
    return Product.supplier_id.in_(managed_supplier_ids())


async def get_managed_supplier_ids(db: AsyncSession) -> Set[int]:
    result = await db.execute(managed_supplier_ids())
    return {row[0] for row in result.all()}


async def supplier_manages_inventory(db: AsyncSession, supplier_id) -> bool:
    if not supplier_id:
        return False
    supplier = await db.get(Supplier, supplier_id)
    return bool(supplier and supplier.manages_inventory)


async def lock_product(db: AsyncSession, product_id: int):
    """Carga el producto bloqueando su fila: dos pedidos a la vez no pueden
    apartar las mismas piezas."""
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


def location_source(code: str) -> str:
    return f"ubicación {code}"


async def located_totals(db: AsyncSession, product_ids: Optional[Iterable[int]] = None) -> Dict[int, int]:
    """Piezas en ubicaciones, por producto."""
    stmt = select(ProductLocation.product_id, func.coalesce(func.sum(ProductLocation.quantity), 0)).group_by(
        ProductLocation.product_id
    )
    if product_ids is not None:
        stmt = stmt.where(ProductLocation.product_id.in_(list(product_ids)))
    return {pid: int(total) for pid, total in (await db.execute(stmt)).all()}


async def reserved_totals(db: AsyncSession, product_ids: Optional[Iterable[int]] = None) -> Dict[int, int]:
    """Piezas apartadas por pedidos activos, por producto."""
    stmt = (
        select(ShoppingListItem.product_id, func.coalesce(func.sum(ShoppingListItem.stock_deducted), 0))
        .join(ShoppingList, ShoppingListItem.list_id == ShoppingList.id)
        .where(ShoppingList.status == "active")
        .group_by(ShoppingListItem.product_id)
    )
    if product_ids is not None:
        stmt = stmt.where(ShoppingListItem.product_id.in_(list(product_ids)))
    return {pid: int(total) for pid, total in (await db.execute(stmt)).all()}


async def sync_stock(db: AsyncSession, product: Product, change_type: str, source: str):
    """Deja la existencia en lo que hay en ubicaciones menos lo apartado y
    registra el cambio."""
    await db.flush()
    located = (await located_totals(db, [product.id])).get(product.id, 0)
    reserved = (await reserved_totals(db, [product.id])).get(product.id, 0)
    old_stock = product.stock_quantity or 0
    new_stock = max(located - reserved, 0)
    if new_stock == old_stock:
        return
    product.stock_quantity = new_stock
    db.add(
        StockHistory(
            product_id=product.id,
            change_type=change_type,
            old_value=old_stock,
            new_value=new_stock,
            source=source,
        )
    )


async def set_location_quantity(
    db: AsyncSession, product: Product, location: Location, quantity: Optional[int]
):
    """Deja `quantity` piezas del producto en la ubicación (None la quita de
    ahí) y mueve la existencia. No deja en ubicaciones menos piezas que las
    apartadas por pedidos activos."""
    result = await db.execute(
        select(ProductLocation).where(
            ProductLocation.location_id == location.id,
            ProductLocation.product_id == product.id,
        )
    )
    item = result.scalar_one_or_none()
    old_quantity = (item.quantity or 0) if item else 0
    delta = (quantity or 0) - old_quantity

    if delta < 0:
        located = (await located_totals(db, [product.id])).get(product.id, 0)
        reserved = (await reserved_totals(db, [product.id])).get(product.id, 0)
        if located + delta < reserved:
            raise HTTPException(
                400,
                f"{reserved} piezas de {product.name} están apartadas en pedidos activos: "
                f"solo puedes quitar {max(located - reserved, 0)} de las ubicaciones",
            )

    if quantity is None:
        if item:
            await db.delete(item)
    elif item:
        item.quantity = quantity
    else:
        db.add(ProductLocation(location_id=location.id, product_id=product.id, quantity=quantity))

    await sync_stock(db, product, "ENTRADA" if delta > 0 else "SALIDA", location_source(location.code))


async def reconcile_stock(db: AsyncSession, supplier_id: Optional[int] = None) -> int:
    """Hace que la existencia cuadre con las ubicaciones. Las piezas sin
    estante van a la ubicación SINUBICAR para no perderlas; si hay más en
    estantes que en existencia, mandan los estantes. Devuelve cuántos
    productos cambió."""
    stmt = select(Product).where(product_in_inventory())
    if supplier_id is not None:
        stmt = stmt.where(Product.supplier_id == supplier_id)
    products = (await db.execute(stmt)).scalars().all()
    if not products:
        return 0
    ids = [p.id for p in products]
    located = await located_totals(db, ids)
    reserved = await reserved_totals(db, ids)

    unlocated = None
    changed = 0
    for product in products:
        excess = (product.stock_quantity or 0) - (located.get(product.id, 0) - reserved.get(product.id, 0))
        if excess == 0:
            continue
        if excess > 0:
            if unlocated is None:
                unlocated = (
                    await db.execute(select(Location).where(Location.code == UNLOCATED_CODE))
                ).scalar_one_or_none()
                if unlocated is None:
                    unlocated = Location(code=UNLOCATED_CODE, description="Piezas por acomodar en un estante")
                    db.add(unlocated)
                    await db.flush()
            item = (
                await db.execute(
                    select(ProductLocation).where(
                        ProductLocation.location_id == unlocated.id,
                        ProductLocation.product_id == product.id,
                    )
                )
            ).scalar_one_or_none()
            if item:
                item.quantity = (item.quantity or 0) + excess
            else:
                db.add(ProductLocation(location_id=unlocated.id, product_id=product.id, quantity=excess))
        else:
            await sync_stock(db, product, "AJUSTE", "conciliación con ubicaciones")
        changed += 1
    return changed


def set_deducted(db: AsyncSession, product: Product, item, target: int, source: str):
    """Deja `target` piezas del renglón apartadas del almacén: aparta o
    regresa solo la diferencia con lo que ya tenía apartado."""
    target = max(int(target), 0)
    delta = target - (item.stock_deducted or 0)
    if delta == 0:
        return
    old_stock = product.stock_quantity or 0
    if delta > 0 and old_stock < delta:
        max_allowed = (item.stock_deducted or 0) + old_stock
        raise HTTPException(
            400,
            f"No hay suficientes piezas de {product.name}: "
            f"el máximo para este pedido es {max_allowed}",
        )
    product.stock_quantity = old_stock - delta
    item.stock_deducted = target
    db.add(
        StockHistory(
            product_id=product.id,
            change_type="PEDIDO" if delta > 0 else "REGRESO",
            old_value=old_stock,
            new_value=product.stock_quantity,
            source=source,
        )
    )
