from typing import Set

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.domain.models import Product, StockHistory, Supplier

# Solo los productos de proveedores con gestión de inventario llevan stock,
# ubicaciones y reportes de inventario. Un producto sin proveedor queda fuera.

INVENTORY_DISABLED_MESSAGE = (
    "El proveedor de este producto no tiene gestión de inventario. "
    "Actívala en Configuración."
)


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


def set_deducted(db: AsyncSession, product: Product, item, target: int, source: str):
    """Deja `target` piezas del renglón descontadas del almacén: descuenta o
    regresa solo la diferencia con lo que ya tenía descontado."""
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
