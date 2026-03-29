from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import Optional, List
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.domain.models import Category, ProductCategory, Product, ProductLocation, Location

router = APIRouter()


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# --- Schemas ---

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    color: str = Field("blue", max_length=20)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)
    color: Optional[str] = Field(None, max_length=20)


class AddProductsToCategory(BaseModel):
    product_ids: List[int] = Field(..., min_length=1)


# --- Endpoints ---

@router.get("")
async def get_categories(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Category, func.count(ProductCategory.id).label("product_count"))
        .outerjoin(ProductCategory, Category.id == ProductCategory.category_id)
        .group_by(Category.id)
        .order_by(Category.name.asc())
    )
    result = await db.execute(stmt)
    return [
        {
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "color": cat.color,
            "created_at": cat.created_at,
            "product_count": count,
        }
        for cat, count in result.all()
    ]


@router.post("")
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    clean_name = data.name.strip()
    existing = await db.execute(
        select(Category).where(func.lower(Category.name) == clean_name.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ya existe una categoría con ese nombre")

    category = Category(
        name=clean_name,
        description=data.description.strip() if data.description else None,
        color=data.color.strip() if data.color else "blue",
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return {"id": category.id, "name": category.name}


@router.get("/search-products")
async def search_products_for_category(
    q: Optional[str] = None,
    category_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product)
    if q:
        q_safe = escape_like(q[:200])
        stmt = stmt.where(
            or_(
                Product.name.ilike(f"%{q_safe}%"),
                Product.sku.ilike(f"%{q_safe}%"),
                Product.alias.ilike(f"%{q_safe}%"),
                Product.upc.ilike(f"%{q_safe}%"),
            )
        )
    stmt = stmt.order_by(Product.name.asc()).limit(50)
    result = await db.execute(stmt)
    products = result.scalars().all()

    existing_ids = set()
    if category_id:
        existing = await db.execute(
            select(ProductCategory.product_id).where(
                ProductCategory.category_id == category_id
            )
        )
        existing_ids = {row[0] for row in existing.all()}

    return [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku or "",
            "upc": p.upc or "",
            "price": p.price,
            "selling_price": p.selling_price,
            "image_url": p.image_url or "",
            "already_in_category": p.id in existing_ids,
        }
        for p in products
    ]


@router.get("/{category_id}")
async def get_category_detail(category_id: int, db: AsyncSession = Depends(get_db)):
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Categoría no encontrada")

    stmt = (
        select(ProductCategory, Product)
        .join(Product, ProductCategory.product_id == Product.id)
        .where(ProductCategory.category_id == category_id)
        .order_by(Product.name.asc())
    )
    result = await db.execute(stmt)

    products = []
    for pc, p in result.all():
        # Get locations for each product
        loc_stmt = (
            select(ProductLocation, Location)
            .join(Location, ProductLocation.location_id == Location.id)
            .where(ProductLocation.product_id == p.id)
            .order_by(Location.code.asc())
        )
        loc_result = await db.execute(loc_stmt)
        locs = [
            {"code": loc.code, "quantity": pl.quantity}
            for pl, loc in loc_result.all()
        ]

        products.append({
            "id": pc.id,
            "product_id": p.id,
            "name": p.name,
            "sku": p.sku or "",
            "upc": p.upc or "",
            "alias": p.alias or "",
            "image_url": p.image_url or "",
            "price": p.price,
            "selling_price": p.selling_price,
            "locations": locs,
            "added_at": pc.added_at,
        })

    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "color": category.color,
        "created_at": category.created_at,
        "products": products,
        "product_count": len(products),
    }


@router.put("/{category_id}")
async def update_category(
    category_id: int, data: CategoryUpdate, db: AsyncSession = Depends(get_db)
):
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Categoría no encontrada")

    if data.name is not None:
        clean_name = data.name.strip()
        dup = await db.execute(
            select(Category).where(
                func.lower(Category.name) == clean_name.lower(),
                Category.id != category_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(400, "Ya existe una categoría con ese nombre")
        category.name = clean_name

    if data.description is not None:
        category.description = data.description.strip() if data.description.strip() else None

    if data.color is not None:
        category.color = data.color.strip()

    await db.commit()
    return {"message": "Categoría actualizada"}


@router.delete("/{category_id}")
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Categoría no encontrada")

    await db.delete(category)
    await db.commit()
    return {"message": "Categoría eliminada"}


@router.post("/{category_id}/products")
async def add_products_to_category(
    category_id: int, data: AddProductsToCategory, db: AsyncSession = Depends(get_db)
):
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Categoría no encontrada")

    added = 0
    for pid in data.product_ids:
        existing = await db.execute(
            select(ProductCategory).where(
                ProductCategory.category_id == category_id,
                ProductCategory.product_id == pid,
            )
        )
        if not existing.scalar_one_or_none():
            product = await db.get(Product, pid)
            if product:
                db.add(ProductCategory(category_id=category_id, product_id=pid))
                added += 1

    await db.commit()
    return {"message": f"{added} producto(s) agregado(s)", "added": added}


@router.delete("/{category_id}/products/{product_id}")
async def remove_product_from_category(
    category_id: int, product_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ProductCategory).where(
            ProductCategory.category_id == category_id,
            ProductCategory.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Producto no encontrado en esta categoría")

    await db.delete(item)
    await db.commit()
    return {"message": "Producto removido de la categoría"}
