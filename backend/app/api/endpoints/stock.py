from typing import Literal, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.domain.models import Location, Product, ProductLocation, Supplier
from app.services.inventory import product_in_inventory, reserved_totals

router = APIRouter()

# Existencias del almacén. Las piezas se cuentan en sus ubicaciones: para
# corregir una existencia se cambia la cantidad de la ubicación, no el total.


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("")
async def get_stock(
    q: Optional[str] = None,
    availability: Literal["all", "in", "out"] = "all",
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

    if availability == "in":
        stmt = stmt.where(Product.stock_quantity > 0)
    elif availability == "out":
        stmt = stmt.where(or_(Product.stock_quantity <= 0, Product.stock_quantity == None))

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar() or 0
    stmt = stmt.order_by(Product.name.asc()).limit(min(limit, 200)).offset(max(offset, 0))
    rows = (await db.execute(stmt)).all()

    # Ubicaciones y piezas apartadas de la página en una consulta cada una
    locations = {}
    reserved = {}
    product_ids = [p.id for p, _ in rows]
    if product_ids:
        loc_rows = await db.execute(
            select(ProductLocation.product_id, Location.id, Location.code, ProductLocation.quantity)
            .join(Location, ProductLocation.location_id == Location.id)
            .where(ProductLocation.product_id.in_(product_ids))
            .order_by(Location.code.asc())
        )
        for product_id, location_id, code, quantity in loc_rows.all():
            locations.setdefault(product_id, []).append(
                {"location_id": location_id, "code": code, "quantity": quantity or 0}
            )
        reserved = await reserved_totals(db, product_ids)

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
                "reserved": reserved.get(p.id, 0),
                "locations": locations.get(p.id, []),
            }
            for p, supplier_name in rows
        ],
    }
