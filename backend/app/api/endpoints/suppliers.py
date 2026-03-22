from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update, or_
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.domain.models import Supplier, Product

router = APIRouter()


class SupplierCreate(BaseModel):
    rfc: str
    name: str


class SupplierUpdate(BaseModel):
    rfc: Optional[str] = None
    name: Optional[str] = None


@router.get("")
async def get_suppliers(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Supplier, func.count(Product.id).label("product_count"))
        .outerjoin(Product, Supplier.id == Product.supplier_id)
        .group_by(Supplier.id)
        .order_by(Supplier.name.asc())
    )
    result = await db.execute(stmt)
    return [
        {
            "id": s.id,
            "rfc": s.rfc,
            "name": s.name,
            "created_at": s.created_at,
            "product_count": count,
        }
        for s, count in result.all()
    ]


@router.post("")
async def create_supplier(data: SupplierCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Supplier).where(Supplier.rfc == data.rfc.strip().upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ya existe un proveedor con ese RFC")

    supplier = Supplier(rfc=data.rfc.strip().upper(), name=data.name.strip())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return {"id": supplier.id, "rfc": supplier.rfc, "name": supplier.name}


@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: int, data: SupplierUpdate, db: AsyncSession = Depends(get_db)
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")

    if data.rfc is not None:
        clean_rfc = data.rfc.strip().upper()
        dup = await db.execute(
            select(Supplier).where(Supplier.rfc == clean_rfc, Supplier.id != supplier_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(400, "RFC ya en uso por otro proveedor")
        supplier.rfc = clean_rfc

    if data.name is not None:
        supplier.name = data.name.strip()

    await db.commit()
    return {"message": "Proveedor actualizado"}


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: int, db: AsyncSession = Depends(get_db)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")

    count = await db.execute(
        select(func.count(Product.id)).where(Product.supplier_id == supplier_id)
    )
    if count.scalar() > 0:
        raise HTTPException(400, "No se puede eliminar: tiene productos asociados")

    await db.delete(supplier)
    await db.commit()
    return {"message": "Proveedor eliminado"}


# --- ASIGNACIÓN MASIVA DE PROVEEDOR ---
class BulkAssignRequest(BaseModel):
    product_ids: List[int]
    supplier_id: int


@router.post("/bulk-assign")
async def bulk_assign_supplier(
    data: BulkAssignRequest, db: AsyncSession = Depends(get_db)
):
    supplier = await db.get(Supplier, data.supplier_id)
    if not supplier:
        raise HTTPException(404, "Proveedor no encontrado")

    await db.execute(
        update(Product)
        .where(Product.id.in_(data.product_ids))
        .values(supplier_id=data.supplier_id)
    )
    await db.commit()
    return {"message": f"{len(data.product_ids)} productos asignados a {supplier.name}"}


# --- PRODUCTOS SIN PROVEEDOR ---
@router.get("/unassigned-products")
async def get_unassigned_products(
    q: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(
        or_(Product.supplier_id == None, Product.supplier_id == 0)
    )
    if q:
        stmt = stmt.where(
            or_(
                Product.name.ilike(f"%{q}%"),
                Product.sku.ilike(f"%{q}%"),
            )
        )
    stmt = stmt.order_by(Product.name.asc()).limit(200)
    result = await db.execute(stmt)
    return [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku or "",
            "price": p.price,
        }
        for p in result.scalars().all()
    ]
