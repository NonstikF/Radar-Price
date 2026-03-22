from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.domain.models import ShoppingList, ShoppingListItem, Product, Supplier

router = APIRouter()


class AddItemRequest(BaseModel):
    product_id: int
    quantity: int = 1


class UpdateItemRequest(BaseModel):
    quantity: int


class UpdateStatusRequest(BaseModel):
    status: str  # "active", "completed", "cancelled"


class UpdateNotesRequest(BaseModel):
    notes: Optional[str] = None


# --- LISTAR TODAS LAS LISTAS ---
@router.get("")
async def get_shopping_lists(
    status: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(
            ShoppingList,
            Supplier.name.label("supplier_name"),
            Supplier.rfc.label("supplier_rfc"),
            func.count(ShoppingListItem.id).label("item_count"),
        )
        .join(Supplier, ShoppingList.supplier_id == Supplier.id)
        .outerjoin(ShoppingListItem, ShoppingList.id == ShoppingListItem.list_id)
        .group_by(ShoppingList.id, Supplier.name, Supplier.rfc)
        .order_by(ShoppingList.updated_at.desc())
    )

    if status:
        stmt = stmt.where(ShoppingList.status == status)

    result = await db.execute(stmt)
    return [
        {
            "id": sl.id,
            "supplier_id": sl.supplier_id,
            "supplier_name": supplier_name,
            "supplier_rfc": supplier_rfc,
            "status": sl.status,
            "notes": sl.notes,
            "item_count": item_count,
            "created_at": sl.created_at,
            "updated_at": sl.updated_at,
        }
        for sl, supplier_name, supplier_rfc, item_count in result.all()
    ]


# --- DETALLE DE UNA LISTA ---
@router.get("/{list_id}")
async def get_shopping_list(list_id: int, db: AsyncSession = Depends(get_db)):
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")

    supplier = await db.get(Supplier, sl.supplier_id)

    stmt = (
        select(ShoppingListItem, Product)
        .join(Product, ShoppingListItem.product_id == Product.id)
        .where(ShoppingListItem.list_id == list_id)
        .order_by(ShoppingListItem.added_at.desc())
    )
    result = await db.execute(stmt)

    items = []
    for item, product in result.all():
        items.append(
            {
                "id": item.id,
                "product_id": product.id,
                "product_name": product.name,
                "product_alias": product.alias or "",
                "product_sku": product.sku or "",
                "price": product.price,
                "selling_price": product.selling_price,
                "quantity": item.quantity,
                "subtotal": round(product.price * item.quantity, 2),
                "added_at": item.added_at,
            }
        )

    return {
        "id": sl.id,
        "supplier_id": sl.supplier_id,
        "supplier_name": supplier.name if supplier else "Sin proveedor",
        "supplier_rfc": supplier.rfc if supplier else "",
        "status": sl.status,
        "notes": sl.notes,
        "created_at": sl.created_at,
        "updated_at": sl.updated_at,
        "items": items,
        "total": round(sum(i["subtotal"] for i in items), 2),
    }


# --- AGREGAR PRODUCTO A LISTA (LÓGICA PRINCIPAL) ---
@router.post("/add-item")
async def add_item_to_list(data: AddItemRequest, db: AsyncSession = Depends(get_db)):
    # 1. Buscar producto
    product = await db.get(Product, data.product_id)
    if not product:
        raise HTTPException(404, "Producto no encontrado")

    if not product.supplier_id:
        raise HTTPException(400, "Este producto no tiene proveedor asignado")

    # 2. Buscar lista activa del proveedor
    stmt = select(ShoppingList).where(
        ShoppingList.supplier_id == product.supplier_id,
        ShoppingList.status == "active",
    )
    result = await db.execute(stmt)
    shopping_list = result.scalar_one_or_none()

    # 3. Si no hay lista activa, crear una
    if not shopping_list:
        shopping_list = ShoppingList(
            supplier_id=product.supplier_id,
            status="active",
        )
        db.add(shopping_list)
        await db.flush()

    # 4. Verificar si el producto ya está en la lista
    stmt_item = select(ShoppingListItem).where(
        ShoppingListItem.list_id == shopping_list.id,
        ShoppingListItem.product_id == data.product_id,
    )
    result_item = await db.execute(stmt_item)
    existing_item = result_item.scalar_one_or_none()

    if existing_item:
        existing_item.quantity += data.quantity
    else:
        new_item = ShoppingListItem(
            list_id=shopping_list.id,
            product_id=data.product_id,
            quantity=data.quantity,
        )
        db.add(new_item)

    # Actualizar timestamp de la lista
    shopping_list.updated_at = datetime.utcnow()

    # Guardar valores antes del commit para evitar MissingGreenlet
    saved_supplier_id = product.supplier_id
    saved_list_id = shopping_list.id

    await db.commit()

    # Obtener nombre del proveedor usando el valor guardado
    supplier = await db.get(Supplier, saved_supplier_id)

    return {
        "message": "Agregado a lista de compras",
        "list_id": saved_list_id,
        "supplier_name": supplier.name if supplier else "",
    }


# --- ACTUALIZAR CANTIDAD DE UN ITEM ---
@router.put("/{list_id}/items/{item_id}")
async def update_item(
    list_id: int,
    item_id: int,
    data: UpdateItemRequest,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(ShoppingListItem, item_id)
    if not item or item.list_id != list_id:
        raise HTTPException(404, "Item no encontrado")

    if data.quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = data.quantity

    # Actualizar timestamp de la lista
    sl = await db.get(ShoppingList, list_id)
    if sl:
        sl.updated_at = datetime.utcnow()

    await db.commit()
    return {"message": "Actualizado"}


# --- ELIMINAR ITEM ---
@router.delete("/{list_id}/items/{item_id}")
async def delete_item(
    list_id: int, item_id: int, db: AsyncSession = Depends(get_db)
):
    item = await db.get(ShoppingListItem, item_id)
    if not item or item.list_id != list_id:
        raise HTTPException(404, "Item no encontrado")

    await db.delete(item)
    await db.commit()
    return {"message": "Item eliminado"}


# --- CAMBIAR ESTADO DE LISTA ---
@router.put("/{list_id}/status")
async def update_status(
    list_id: int, data: UpdateStatusRequest, db: AsyncSession = Depends(get_db)
):
    if data.status not in ("active", "completed", "cancelled"):
        raise HTTPException(400, "Estado inválido")

    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")

    sl.status = data.status
    sl.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": f"Lista marcada como {data.status}"}


# --- ACTUALIZAR NOTAS ---
@router.put("/{list_id}/notes")
async def update_notes(
    list_id: int, data: UpdateNotesRequest, db: AsyncSession = Depends(get_db)
):
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")

    sl.notes = data.notes
    sl.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Notas actualizadas"}


# --- ELIMINAR LISTA COMPLETA ---
@router.delete("/{list_id}")
async def delete_shopping_list(list_id: int, db: AsyncSession = Depends(get_db)):
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")

    await db.delete(sl)
    await db.commit()
    return {"message": "Lista eliminada"}
