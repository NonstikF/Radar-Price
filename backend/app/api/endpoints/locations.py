from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import Optional, List
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.domain.models import Location, ProductLocation, Product

router = APIRouter()


def sanitize_code(raw: str) -> str:
    """Limpia código de ubicación: quita espacios, guiones y pasa a mayúsculas."""
    return raw.strip().replace("-", "").upper()[:50]


def escape_like(value: str) -> str:
    """Escapa caracteres especiales de LIKE para evitar inyección en patrones."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class LocationCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class LocationUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class AddProductToLocation(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(1, ge=0, le=999999)


# --- RUTAS FIJAS PRIMERO ---

@router.get("")
async def get_locations(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Location, func.count(ProductLocation.id).label("product_count"))
        .outerjoin(ProductLocation, Location.id == ProductLocation.location_id)
        .group_by(Location.id)
        .order_by(Location.code.asc())
    )
    result = await db.execute(stmt)
    return [
        {
            "id": loc.id,
            "code": loc.code,
            "description": loc.description,
            "created_at": loc.created_at,
            "product_count": count,
        }
        for loc, count in result.all()
    ]


@router.post("")
async def create_location(data: LocationCreate, db: AsyncSession = Depends(get_db)):
    clean_code = sanitize_code(data.code)
    if not clean_code:
        raise HTTPException(400, "El código es requerido")

    existing = await db.execute(
        select(Location).where(Location.code == clean_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ya existe una ubicación con ese código")

    location = Location(
        code=clean_code,
        description=data.description.strip() if data.description else None,
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return {"id": location.id, "code": location.code, "description": location.description}


@router.get("/search")
async def search_locations(q: str = "", db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Location, func.count(ProductLocation.id).label("product_count"))
        .outerjoin(ProductLocation, Location.id == ProductLocation.location_id)
    )
    if q:
        q_safe = escape_like(q[:100])
        stmt = stmt.where(
            or_(
                Location.code.ilike(f"%{q_safe}%"),
                Location.description.ilike(f"%{q_safe}%"),
            )
        )
    stmt = stmt.group_by(Location.id).order_by(Location.code.asc()).limit(50)
    result = await db.execute(stmt)
    return [
        {
            "id": loc.id,
            "code": loc.code,
            "description": loc.description,
            "product_count": count,
        }
        for loc, count in result.all()
    ]


@router.get("/by-code/{code}")
async def get_location_by_code(code: str, db: AsyncSession = Depends(get_db)):
    clean_code = sanitize_code(code)
    result = await db.execute(
        select(Location).where(Location.code == clean_code)
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(404, "Ubicación no encontrada")
    return {"id": location.id, "code": location.code, "description": location.description}


@router.get("/search-products")
async def search_products_for_location(
    q: Optional[str] = None,
    location_id: Optional[int] = None,
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
            )
        )
    stmt = stmt.order_by(Product.name.asc()).limit(50)
    result = await db.execute(stmt)
    products = result.scalars().all()

    existing_ids = set()
    if location_id:
        existing = await db.execute(
            select(ProductLocation.product_id).where(
                ProductLocation.location_id == location_id
            )
        )
        existing_ids = {row[0] for row in existing.all()}

    return [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku or "",
            "price": p.price,
            "image_url": p.image_url or "",
            "already_in_location": p.id in existing_ids,
        }
        for p in products
    ]


@router.get("/product/{product_id}/locations")
async def get_product_locations(product_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene todas las ubicaciones donde está un producto."""
    stmt = (
        select(ProductLocation, Location)
        .join(Location, ProductLocation.location_id == Location.id)
        .where(ProductLocation.product_id == product_id)
        .order_by(Location.code.asc())
    )
    result = await db.execute(stmt)
    return [
        {
            "location_id": loc.id,
            "code": loc.code,
            "description": loc.description,
            "quantity": pl.quantity,
        }
        for pl, loc in result.all()
    ]


# --- RUTAS DINÁMICAS ---

@router.get("/{location_id}")
async def get_location_detail(location_id: int, db: AsyncSession = Depends(get_db)):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Ubicación no encontrada")

    stmt = (
        select(ProductLocation, Product)
        .join(Product, ProductLocation.product_id == Product.id)
        .where(ProductLocation.location_id == location_id)
        .order_by(Product.name.asc())
    )
    result = await db.execute(stmt)
    products = [
        {
            "id": pl.id,
            "product_id": p.id,
            "name": p.name,
            "sku": p.sku or "",
            "alias": p.alias or "",
            "image_url": p.image_url or "",
            "price": p.price,
            "selling_price": p.selling_price,
            "quantity": pl.quantity,
        }
        for pl, p in result.all()
    ]

    return {
        "id": location.id,
        "code": location.code,
        "description": location.description,
        "created_at": location.created_at,
        "products": products,
        "product_count": len(products),
    }


@router.put("/{location_id}")
async def update_location(
    location_id: int, data: LocationUpdate, db: AsyncSession = Depends(get_db)
):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Ubicación no encontrada")

    if data.code is not None:
        clean_code = sanitize_code(data.code)
        if not clean_code:
            raise HTTPException(400, "El código no puede estar vacío")
        dup = await db.execute(
            select(Location).where(Location.code == clean_code, Location.id != location_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(400, "Código ya en uso por otra ubicación")
        location.code = clean_code

    if data.description is not None:
        location.description = data.description.strip() if data.description.strip() else None

    await db.commit()
    return {"message": "Ubicación actualizada"}


@router.delete("/{location_id}")
async def delete_location(location_id: int, db: AsyncSession = Depends(get_db)):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Ubicación no encontrada")

    count = await db.execute(
        select(func.count(ProductLocation.id)).where(
            ProductLocation.location_id == location_id
        )
    )
    if count.scalar() > 0:
        raise HTTPException(400, "No se puede eliminar: tiene productos asignados")

    await db.delete(location)
    await db.commit()
    return {"message": "Ubicación eliminada"}


@router.post("/{location_id}/products")
async def add_product_to_location(
    location_id: int, data: AddProductToLocation, db: AsyncSession = Depends(get_db)
):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Ubicación no encontrada")

    product = await db.get(Product, data.product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado")

    existing = await db.execute(
        select(ProductLocation).where(
            ProductLocation.location_id == location_id,
            ProductLocation.product_id == data.product_id,
        )
    )
    item = existing.scalar_one_or_none()

    if item:
        item.quantity += data.quantity
    else:
        item = ProductLocation(
            location_id=location_id,
            product_id=data.product_id,
            quantity=data.quantity,
        )
        db.add(item)

    product_name = product.name
    location_code = location.code
    await db.commit()

    return {"message": f"{product_name} agregado a {location_code}"}


class UpdateQuantity(BaseModel):
    quantity: int = Field(..., ge=0, le=999999)


@router.put("/{location_id}/products/{product_id}")
async def update_product_quantity(
    location_id: int, product_id: int, data: UpdateQuantity, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ProductLocation).where(
            ProductLocation.location_id == location_id,
            ProductLocation.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Producto no encontrado en esta ubicación")

    item.quantity = data.quantity
    await db.commit()
    return {"message": "Cantidad actualizada"}


@router.delete("/{location_id}/products/{product_id}")
async def remove_product_from_location(
    location_id: int, product_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ProductLocation).where(
            ProductLocation.location_id == location_id,
            ProductLocation.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Producto no encontrado en esta ubicación")

    await db.delete(item)
    await db.commit()
    return {"message": "Producto removido de la ubicación"}
