from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc
from app.core.database import get_db
from app.domain.models import StockHistory, Product, Supplier

router = APIRouter()


@router.get("/stock-history")
async def get_stock_history(
    q: str = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            StockHistory.id,
            StockHistory.change_type,
            StockHistory.old_value,
            StockHistory.new_value,
            StockHistory.source,
            StockHistory.date,
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku,
        )
        .join(Product, StockHistory.product_id == Product.id)
        .order_by(desc(StockHistory.date))
    )

    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%") | Product.sku.ilike(f"%{q}%"))

    count_subq = stmt.subquery()
    total = (await db.execute(select(func.count(count_subq.c.id)))).scalar() or 0

    stmt = stmt.limit(min(limit, 200)).offset(max(offset, 0))
    rows = (await db.execute(stmt)).all()

    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "product_name": r.product_name,
                "sku": r.sku,
                "change_type": r.change_type,
                "old_value": r.old_value,
                "new_value": r.new_value,
                "diff": r.new_value - r.old_value,
                "source": r.source,
                "date": r.date,
            }
            for r in rows
        ],
    }


@router.get("/summary")
async def get_inventory_summary(db: AsyncSession = Depends(get_db)):
    # Total productos
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0

    # Valor de inventario (stock × costo y stock × precio venta)
    value_result = (
        await db.execute(
            select(
                func.sum(Product.stock_quantity * Product.price).label("cost_value"),
                func.sum(Product.stock_quantity * Product.selling_price).label("sale_value"),
            )
        )
    ).one()

    # Sin precio de venta
    no_price = (
        await db.execute(
            select(func.count(Product.id)).where(
                (Product.selling_price == None) | (Product.selling_price == 0)
            )
        )
    ).scalar() or 0

    # Margen negativo (costo > precio venta)
    negative_margin = (
        await db.execute(
            select(func.count(Product.id)).where(
                Product.selling_price > 0,
                Product.price > Product.selling_price,
            )
        )
    ).scalar() or 0

    # Sin stock
    no_stock = (
        await db.execute(
            select(func.count(Product.id)).where(Product.stock_quantity <= 0)
        )
    ).scalar() or 0

    # Movimientos hoy
    from datetime import datetime, date
    today_start = datetime.combine(date.today(), datetime.min.time())
    movements_today = (
        await db.execute(
            select(func.count(StockHistory.id)).where(StockHistory.date >= today_start)
        )
    ).scalar() or 0

    return {
        "total_products": total_products,
        "cost_value": round(value_result.cost_value or 0, 2),
        "sale_value": round(value_result.sale_value or 0, 2),
        "no_price": no_price,
        "negative_margin": negative_margin,
        "no_stock": no_stock,
        "movements_today": movements_today,
    }
