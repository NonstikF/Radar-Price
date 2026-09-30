from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import verify_admin
from app.domain.models import ShoppingList, ShoppingListItem, Product, Supplier
from app.services.inventory import lock_product, set_deducted, supplier_manages_inventory

router = APIRouter()

# Las listas de proveedores sin inventario funcionan libres, como siempre.
# Las de proveedores con gestión de inventario son pedidos al almacén:
# descuentan las piezas al pedirlas y no pueden pasar de la existencia. Una
# lista cancelada regresa todo; completar (surtir) no mueve stock porque ya
# se descontó al pedir.
ACTIVE_ONLY_MESSAGE = "Solo se pueden modificar pedidos activos del almacén"


async def is_warehouse_item(db, item) -> bool:
    """El renglón mueve stock: su producto es del almacén o ya descontó piezas."""
    if item.stock_deducted:
        return True
    product = await db.get(Product, item.product_id)
    return bool(product and await supplier_manages_inventory(db, product.supplier_id))


def order_source(list_id: int) -> str:
    return f"pedido:{list_id}"


async def sync_item_stock(db, item, list_status: str, removing: bool = False):
    """Ajusta lo descontado de un renglón a su estado: cancelado o quitado no
    descuenta nada; en otro caso descuenta su cantidad si el producto es del
    almacén. Un producto que salió del almacén solo puede regresar piezas."""
    product = await lock_product(db, item.product_id)
    if not product:
        return
    if removing or list_status == "cancelled":
        target = 0
    elif await supplier_manages_inventory(db, product.supplier_id):
        target = item.quantity
    else:
        target = min(item.stock_deducted or 0, item.quantity)
    set_deducted(db, product, item, target, order_source(item.list_id))


class AddItemRequest(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1, le=999999)


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
            Supplier.manages_inventory.label("manages_inventory"),
            func.count(ShoppingListItem.id).label("item_count"),
        )
        .join(Supplier, ShoppingList.supplier_id == Supplier.id)
        .outerjoin(ShoppingListItem, ShoppingList.id == ShoppingListItem.list_id)
        .group_by(ShoppingList.id, Supplier.name, Supplier.rfc, Supplier.manages_inventory)
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
            "manages_inventory": bool(manages_inventory),
            "status": sl.status,
            "notes": sl.notes,
            "item_count": item_count,
            "created_at": sl.created_at,
            "updated_at": sl.updated_at,
        }
        for sl, supplier_name, supplier_rfc, manages_inventory, item_count in result.all()
    ]


# --- DETALLE DE UNA LISTA ---
@router.get("/{list_id}")
async def get_shopping_list(list_id: int, db: AsyncSession = Depends(get_db)):
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")

    supplier = await db.get(Supplier, sl.supplier_id)
    manages_inventory = bool(supplier and supplier.manages_inventory)

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
                # Tope al editar: lo ya descontado más lo que queda en almacén
                "max_quantity": (
                    (item.stock_deducted or 0) + (product.stock_quantity or 0)
                    if manages_inventory
                    else None
                ),
                "subtotal": round(product.price * item.quantity, 2),
                "added_at": item.added_at,
            }
        )

    return {
        "id": sl.id,
        "supplier_id": sl.supplier_id,
        "supplier_name": supplier.name if supplier else "Sin proveedor",
        "supplier_rfc": supplier.rfc if supplier else "",
        "manages_inventory": manages_inventory,
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
    # 1. Buscar producto (bloqueado: se va a descontar su stock)
    product = await lock_product(db, data.product_id)
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
        item = existing_item
        item.quantity += data.quantity
    else:
        item = ShoppingListItem(
            list_id=shopping_list.id,
            product_id=data.product_id,
            quantity=data.quantity,
            stock_deducted=0,
        )
        db.add(item)

    # 5. Productos del almacén: descontar (falla si se pide más de lo que hay)
    if await supplier_manages_inventory(db, product.supplier_id):
        set_deducted(db, product, item, item.quantity, order_source(shopping_list.id))

    # Actualizar timestamp de la lista
    shopping_list.updated_at = datetime.utcnow()

    # Guardar valores antes del commit para evitar MissingGreenlet
    saved_supplier_id = product.supplier_id
    saved_list_id = shopping_list.id

    await db.commit()

    # Obtener nombre del proveedor usando el valor guardado
    supplier = await db.get(Supplier, saved_supplier_id)

    return {
        "message": "Agregado al pedido",
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
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")
    if sl.status != "active" and await is_warehouse_item(db, item):
        raise HTTPException(400, ACTIVE_ONLY_MESSAGE)

    if data.quantity <= 0:
        await sync_item_stock(db, item, sl.status, removing=True)
        await db.delete(item)
    else:
        item.quantity = data.quantity
        await sync_item_stock(db, item, sl.status)

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
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")
    if sl.status != "active" and await is_warehouse_item(db, item):
        raise HTTPException(400, ACTIVE_ONLY_MESSAGE)

    # Las piezas regresan al almacén
    await sync_item_stock(db, item, sl.status, removing=True)
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
    if data.status == sl.status:
        return {"message": f"Lista marcada como {data.status}"}

    # Solo puede haber un pedido activo por proveedor
    if data.status == "active":
        other = await db.execute(
            select(ShoppingList.id).where(
                ShoppingList.supplier_id == sl.supplier_id,
                ShoppingList.status == "active",
                ShoppingList.id != list_id,
            )
        )
        if other.first():
            raise HTTPException(400, "Ya hay un pedido activo de este proveedor")

    # Cancelar regresa las piezas; salir de cancelado las vuelve a descontar.
    # Pasar entre activo y completado (surtido) no mueve stock.
    if data.status == "cancelled" or sl.status == "cancelled":
        items = (
            await db.execute(
                select(ShoppingListItem).where(ShoppingListItem.list_id == list_id)
            )
        ).scalars().all()
        for item in items:
            await sync_item_stock(db, item, data.status)

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
async def delete_shopping_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_admin),
):
    sl = await db.get(ShoppingList, list_id)
    if not sl:
        raise HTTPException(404, "Lista no encontrada")

    # Un pedido activo que se borra regresa sus piezas; uno completado ya se
    # surtió y su mercancía salió del almacén.
    if sl.status == "active":
        items = (
            await db.execute(
                select(ShoppingListItem).where(ShoppingListItem.list_id == list_id)
            )
        ).scalars().all()
        for item in items:
            await sync_item_stock(db, item, sl.status, removing=True)

    await db.delete(sl)
    await db.commit()
    return {"message": "Lista eliminada"}
