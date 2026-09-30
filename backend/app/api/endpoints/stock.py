from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import verify_admin
from app.domain.models import Product, StockHistory, Supplier
from app.services.inventory import (
    INVENTORY_DISABLED_MESSAGE,
    lock_product,
    product_in_inventory,
    supplier_manages_inventory,
)

router = APIRouter()

# Existencias del almacén: consulta y ajuste manual (conteo físico, entradas
# sin factura y mermas). Cada ajuste queda en el historial de stock.

ADJUST_TYPES = {"set": "AJUSTE", "add": "ENTRADA", "subtract": "SALIDA"}


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class StockAdjust(BaseModel):
    # set: la existencia queda en `quantity` (conteo físico)
    # add / subtract: suma o resta `quantity` piezas
    mode: Literal["set", "add", "subtract"]
    quantity: int = Field(..., ge=0, le=999999)
    note: Optional[str] = Field(None, max_length=200)


@router.get("")
async def get_stock(
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product, Supplier.name.label("supplier_name"))
        .join(Supplier, Product.supplier_id == Supplier.id)
        .where(product_in_inventory())
    )
    if q:
        q_safe = escape_like(q[:200])
        stmt = stmt.where(
            or_(
                Product.name.ilike(f"%{q_safe}%"),
                Product.sku.ilike(f"%{q_safe}%"),
                Product.upc.ilike(f"%{q_safe}%"),
                Product.alias.ilike(f"%{q_safe}%"),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar() or 0
    stmt = stmt.order_by(Product.name.asc()).limit(min(limit, 200)).offset(max(offset, 0))
    rows = (await db.execute(stmt)).all()
    return {
        "total": total,
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku or "",
                "alias": p.alias or "",
                "supplier_name": supplier_name,
                "stock": p.stock_quantity or 0,
            }
            for p, supplier_name in rows
        ],
    }


@router.post("/{product_id}/adjust")
async def adjust_stock(
    product_id: int,
    data: StockAdjust,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_admin),
):
    product = await lock_product(db, product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado")
    if not await supplier_manages_inventory(db, product.supplier_id):
        raise HTTPException(400, INVENTORY_DISABLED_MESSAGE)

    old_stock = product.stock_quantity or 0
    if data.mode == "set":
        new_stock = data.quantity
    elif data.mode == "add":
        new_stock = old_stock + data.quantity
    else:
        if data.quantity > old_stock:
            raise HTTPException(400, f"Solo hay {old_stock} piezas; no se pueden restar {data.quantity}")
        new_stock = old_stock - data.quantity

    if new_stock != old_stock:
        product.stock_quantity = new_stock
        db.add(
            StockHistory(
                product_id=product.id,
                change_type=ADJUST_TYPES[data.mode],
                old_value=old_stock,
                new_value=new_stock,
                source=(data.note or "").strip() or "manual",
            )
        )
        await db.commit()
    return {"id": product_id, "stock": new_stock}
