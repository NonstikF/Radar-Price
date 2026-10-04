from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import Optional, List
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import verify_admin
from app.domain.models import Location, ProductLocation, Product
from app.services.inventory import (
    INVENTORY_DISABLED_MESSAGE,
    lock_product,
    product_in_inventory,
    set_location_quantity,
    supplier_manages_inventory,
)

# Las piezas viven en las ubicaciones y la existencia del producto sale de
# ellas: agregar a una ubicación suma, cambiar la cantidad suma o resta la
# diferencia y quitar el producto resta sus piezas.

router = APIRouter()


def sanitize_code(raw: str) -> str:
    """Limpia código de ubicación: quita espacios, guiones y pasa a mayúsculas."""
    return raw.strip().replace("-", "").upper()[:50]


def escape_like(value: str) -> str:
    """Escapa caracteres especiales de LIKE para evitar inyección en patrones."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def visible_product_locations():
    """Asignaciones de productos cuyo proveedor gestiona inventario."""
    return (
        select(ProductLocation.id, ProductLocation.location_id)
        .join(Product, ProductLocation.product_id == Product.id)
        .where(product_in_inventory())
        .subquery()
    )


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
    visible = visible_product_locations()
    stmt = (
        select(Location, func.count(visible.c.id).label("product_count"))
        .outerjoin(visible, Location.id == visible.c.location_id)
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
    visible = visible_product_locations()
    stmt = (
        select(Location, func.count(visible.c.id).label("product_count"))
        .outerjoin(visible, Location.id == visible.c.location_id)
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
    with_locations: bool = False,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).where(product_in_inventory())
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
    if location_id:
        existing = await db.execute(
            select(ProductLocation.product_id).where(
                ProductLocation.location_id == location_id
            )
        )
        existing_ids = {row[0] for row in existing.all()}

    items = []
    for p in products:
        item = {
            "id": p.id,
            "name": p.name,
            "sku": p.sku or "",
            "price": p.price,
            "selling_price": p.selling_price,
            "image_url": p.image_url or "",
            "already_in_location": p.id in existing_ids,
        }
        if with_locations:
            loc_stmt = (
                select(ProductLocation, Location)
                .join(Location, ProductLocation.location_id == Location.id)
                .where(ProductLocation.product_id == p.id)
                .order_by(Location.code.asc())
            )
            loc_result = await db.execute(loc_stmt)
            item["locations"] = [
                {"code": loc.code, "quantity": pl.quantity}
                for pl, loc in loc_result.all()
            ]
        items.append(item)

    return items


class MoveProduct(BaseModel):
    product_id: int = Field(..., gt=0)
    from_location_id: int = Field(..., gt=0)
    to_location_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0, le=999999)


@router.post("/move")
async def move_product(data: MoveProduct, db: AsyncSession = Depends(get_db)):
    """Pasa piezas de una ubicación a otra; la existencia no cambia."""
    if data.from_location_id == data.to_location_id:
        raise HTTPException(400, "Elige una ubicación distinta")
    origin = await db.get(Location, data.from_location_id)
    target = await db.get(Location, data.to_location_id)
    if not origin or not target:
        raise HTTPException(404, "Ubicación no encontrada")

    product = await lock_product(db, data.product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado")
    if not await supplier_manages_inventory(db, product.supplier_id):
        raise HTTPException(400, INVENTORY_DISABLED_MESSAGE)

    rows = {
        pl.location_id: pl
        for pl in (
            await db.execute(
                select(ProductLocation).where(
                    ProductLocation.product_id == product.id,
                    ProductLocation.location_id.in_([origin.id, target.id]),
                )
            )
        ).scalars().all()
    }
    source = rows.get(origin.id)
    available = (source.quantity or 0) if source else 0
    if data.quantity > available:
        raise HTTPException(400, f"En {origin.code} solo hay {available} piezas")

    # El total no cambia, así que no hay movimiento de existencia que registrar
    if target.id in rows:
        rows[target.id].quantity = (rows[target.id].quantity or 0) + data.quantity
    else:
        db.add(ProductLocation(location_id=target.id, product_id=product.id, quantity=data.quantity))
    if available == data.quantity:
        await db.delete(source)
    else:
        source.quantity = available - data.quantity

    message = f"{data.quantity} piezas de {product.name} pasaron de {origin.code} a {target.code}"
    await db.commit()
    return {"message": message}


@router.get("/product/{product_id}/locations")
async def get_product_locations(product_id: int, db: AsyncSession = Depends(get_db)):
    """Obtiene todas las ubicaciones donde está un producto."""
    stmt = (
        select(ProductLocation, Location)
        .join(Location, ProductLocation.location_id == Location.id)
        .join(Product, ProductLocation.product_id == Product.id)
        .where(ProductLocation.product_id == product_id, product_in_inventory())
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
        .where(ProductLocation.location_id == location_id, product_in_inventory())
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
async def delete_location(
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_admin),
):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(404, "Ubicación no encontrada")

    count = await db.execute(
        select(func.count(ProductLocation.id)).where(
            ProductLocation.location_id == location_id
        )
    )
    if count.scalar() > 0:
        visible = await db.execute(
            select(func.count(ProductLocation.id))
            .join(Product, ProductLocation.product_id == Product.id)
            .where(ProductLocation.location_id == location_id, product_in_inventory())
        )
        if visible.scalar() == 0:
            raise HTTPException(
                400,
                "No se puede eliminar: tiene productos de proveedores sin gestión de inventario",
            )
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

    product = await lock_product(db, data.product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado")
    if not await supplier_manages_inventory(db, product.supplier_id):
        raise HTTPException(400, INVENTORY_DISABLED_MESSAGE)

    existing = await db.execute(
        select(ProductLocation.quantity).where(
            ProductLocation.location_id == location_id,
            ProductLocation.product_id == data.product_id,
        )
    )
    current = existing.scalar_one_or_none() or 0
    await set_location_quantity(db, product, location, current + data.quantity)

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
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Producto no encontrado en esta ubicación")

    product = await lock_product(db, product_id)
    if not product or not await supplier_manages_inventory(db, product.supplier_id):
        raise HTTPException(400, INVENTORY_DISABLED_MESSAGE)

    location = await db.get(Location, location_id)
    await set_location_quantity(db, product, location, data.quantity)
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

    product = await lock_product(db, product_id)
    if product and await supplier_manages_inventory(db, product.supplier_id):
        location = await db.get(Location, location_id)
        await set_location_quantity(db, product, location, None)
    else:
        await db.delete(item)
    await db.commit()
    return {"message": "Producto removido de la ubicación"}
