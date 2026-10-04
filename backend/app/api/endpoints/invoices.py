import hashlib
import difflib
import logging
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func, case, update, delete
from typing import List, Dict, Optional, Set
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import verify_admin, verify_upload_permission
from app.services.xml_service import XmlInvoiceParser
from app.services.inventory import set_location_quantity, supplier_manages_inventory, sync_stock
from app.domain.models import (
    Product,
    PriceHistory,
    ImportBatch,
    ImportBatchItem,
    Supplier,
    StockHistory,
    ShoppingListItem,
    ProductCategory,
    ProductLocation,
    Location,
)

logger = logging.getLogger(__name__)
router = APIRouter()
parser = XmlInvoiceParser()
EXTRACTED_SKU_NAME_MATCH_CUTOFF = 0.55


def escape_like(value: str) -> str:
    """Escapa caracteres especiales de LIKE para evitar inyección en patrones."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# --- ESQUEMAS ---
class ManualProductSchema(BaseModel):
    name: str
    sku: Optional[str] = None
    upc: Optional[str] = None
    price: float = 0.0
    selling_price: float = 0.0
    stock: int = 0
    # Ubicación donde quedan las piezas iniciales (productos del almacén)
    location_id: Optional[int] = None
    supplier_id: Optional[int] = None


class BatchUpdateSchema(BaseModel):
    filename: str


class BatchSupplierSchema(BaseModel):
    supplier_id: Optional[int] = None
    # True: todos los productos de la factura pasan a este proveedor.
    # False: solo se llenan los que no tienen proveedor.
    overwrite: bool = False


# --- UTILIDADES ---
def normalize_name(text: str) -> str:
    if not text:
        return ""
    text = str(text).lower()
    text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    text = text.replace("(", " ").replace(")", " ").replace("-", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_code(code: str) -> str:
    if not code:
        return ""
    return re.sub(r"[\W_]+", "", str(code).upper())


# 🔥 MEJORA: Extraer CUALQUIER código numérico posible del texto
def extract_potential_codes(text: str) -> List[str]:
    if not text:
        return []
    # Busca cualquier secuencia de 4 a 6 dígitos (ej: 55850, 123456)
    # \b asegura que no sea parte de un número más largo
    candidates = re.findall(r"\b(\d{4,6})\b", text)
    return list(set(candidates))  # Elimina duplicados


def extract_sku_from_text(text: str) -> str:
    if not text:
        return ""
    candidates = re.findall(r"\b(\d{4,8})\b", text)
    return candidates[-1] if candidates else ""


def names_are_similar(left: str, right: str) -> bool:
    left_norm = normalize_name(left)
    right_norm = normalize_name(right)
    if not left_norm or not right_norm:
        return False
    return (
        difflib.SequenceMatcher(None, left_norm, right_norm).ratio()
        >= EXTRACTED_SKU_NAME_MATCH_CUTOFF
    )


async def get_or_create_supplier(db: AsyncSession, emisor_info: Optional[dict]) -> Optional[int]:
    """Busca el proveedor por el RFC del emisor; lo crea si no existe."""
    if not emisor_info or not emisor_info.get("rfc"):
        return None
    rfc_clean = emisor_info["rfc"].strip().upper()
    stmt_sup = select(Supplier).where(Supplier.rfc == rfc_clean)
    supplier = (await db.execute(stmt_sup)).scalar_one_or_none()
    if not supplier:
        supplier = Supplier(rfc=rfc_clean, name=emisor_info.get("nombre", rfc_clean))
        db.add(supplier)
        await db.flush()
    return supplier.id


# --- 1. SUBIDA XML (MATCHING AGRESIVO) ---
@router.post("/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(verify_upload_permission),
):
    print(f"--- INICIANDO CARGA MEJORADA: {file.filename} ---")

    if not (
        file.filename.endswith(".xml")
        or file.content_type in ["text/xml", "application/xml"]
    ):
        raise HTTPException(status_code=400, detail="Debe ser XML")

    # 1. Check duplicados
    stmt_check = select(ImportBatch).where(ImportBatch.filename == file.filename)
    result_check = await db.execute(stmt_check)
    existing_batch = result_check.scalars().first()

    if existing_batch:
        return {
            "status": "exists",
            "message": "Archivo ya procesado.",
            "batch_id": existing_batch.id,
            "filename": existing_batch.filename,
            "uploaded_at": existing_batch.created_at,
        }

    # 2. Leer XML
    content = await file.read()
    try:
        extracted = await parser.extract_data(content, db)
        extracted_items = extracted["items"]
        emisor_info = extracted.get("emisor")
    except Exception as e:
        logger.error(f"Error XML: {e}")
        raise HTTPException(500, f"Error leyendo estructura XML: {str(e)}")

    # 2.5 Crear/obtener proveedor desde emisor
    supplier_id = await get_or_create_supplier(db, emisor_info)

    # 3. Crear Lote
    new_batch = ImportBatch(
        filename=file.filename, created_at=datetime.now(), supplier_id=supplier_id
    )
    db.add(new_batch)
    await db.flush()
    current_batch_id = new_batch.id

    # 4. Cargar Inventario Actual
    stmt = select(Product)
    all_db_products = (await db.execute(stmt)).scalars().all()
    # Las facturas no suman existencia: las piezas del almacén se dan de alta
    # en sus ubicaciones.

    sku_map = {clean_code(p.sku): p for p in all_db_products if p.sku}
    upc_map = {clean_code(p.upc): p for p in all_db_products if p.upc}
    name_map = {normalize_name(p.name): p for p in all_db_products}
    fuzzy_keys = list(name_map.keys())

    # SKUs ya ocupados (en BD). La columna sku es UNIQUE: si asignamos uno
    # repetido el flush lanza IntegrityError. Reservamos aquí los que vamos
    # usando durante el lote para no duplicar ni contra BD ni entre productos
    # nuevos del mismo XML.
    used_skus = set(sku_map.keys())

    # 5. Agrupar Items
    grouped_items = {}
    for item in extracted_items:
        # Agrupar por NOMBRE primero: el NoIdentificacion del SAT suele ser un
        # código de familia genérico (ej: "CALCETA", "ARTCABELLO", "60106500")
        # compartido por productos distintos. Usar el SKU como clave los fusiona
        # erróneamente. La descripción sí es única por producto.
        key = (
            normalize_name(item.get("name", ""))
            or clean_code(item.get("sku", ""))
            or clean_code(item.get("upc", ""))
        )
        if not key:
            continue

        qty_val = float(item.get("quantity", 0))
        cost = float(item.get("unit_price_no_tax", 0))
        line_val = qty_val * cost

        if key in grouped_items:
            grouped_items[key]["qty"] += qty_val
            grouped_items[key]["total_value"] += line_val
            if grouped_items[key]["qty"] > 0:
                grouped_items[key]["cost"] = (
                    grouped_items[key]["total_value"] / grouped_items[key]["qty"]
                )
        else:
            grouped_items[key] = {
                "sku": item.get("sku", ""),
                "sku_source": item.get("sku_source", ""),
                "upc": item.get("upc", ""),
                "name": item.get("name", "Sin Nombre"),
                "qty": qty_val,
                "cost": cost,
                "cost_tax": float(item.get("unit_price_with_tax", 0)),
                "total_value": line_val,
            }

    # 6. Procesamiento
    final_response_data = []
    new_products_buffer = []
    price_history_buffer = []
    batch_items_buffer = []
    temp_new_products_map = []  # Memoria temporal para evitar error Greenlet

    for key, data in grouped_items.items():
        existing_product = None
        xml_sku = clean_code(data["sku"])
        sku_from_description = data.get("sku_source") == "description"
        xml_upc = clean_code(data.get("upc", ""))
        xml_name_norm = normalize_name(data["name"])
        potential_codes = extract_potential_codes(data["name"])

        # Búsqueda
        if xml_sku and xml_sku in sku_map:
            sku_candidate = sku_map[xml_sku]
            if not sku_from_description or names_are_similar(data["name"], sku_candidate.name):
                existing_product = sku_candidate
        if not existing_product and xml_upc and xml_upc in upc_map:
            existing_product = upc_map[xml_upc]
        if not existing_product and xml_name_norm in name_map:
            existing_product = name_map[xml_name_norm]

        status = "ok"
        suggestions = []
        p_id = None
        p_selling_price = 0.0
        old_cost = 0.0

        if existing_product:
            # --- PRODUCTO EXISTENTE ---
            p_id = existing_product.id
            old_cost = existing_product.price

            # Actualizar datos si faltan
            sku_cand = xml_sku
            if not sku_cand and potential_codes and not existing_product.sku:
                sku_cand = potential_codes[0]

            if sku_cand and not existing_product.sku:
                if sku_from_description and clean_code(sku_cand) in sku_map:
                    sku_cand = ""
            # No asignar un SKU que ya esté ocupado (UNIQUE)
            if sku_cand and clean_code(sku_cand) in used_skus:
                sku_cand = ""
            if sku_cand and not existing_product.sku:
                existing_product.sku = sku_cand
                used_skus.add(clean_code(sku_cand))
            if not existing_product.upc and data.get("upc"):
                existing_product.upc = data.get("upc")

            # Asignar proveedor si no tiene
            if supplier_id and not existing_product.supplier_id:
                existing_product.supplier_id = supplier_id

            if abs(existing_product.price - data["cost"]) > 0.1:
                status = "price_changed"
                price_history_buffer.append(
                    PriceHistory(
                        product_id=existing_product.id,
                        change_type="COSTO",
                        old_value=existing_product.price,
                        new_value=data["cost"],
                    )
                )
            existing_product.price = data["cost"]
            p_selling_price = (
                existing_product.selling_price
                if existing_product.selling_price
                else 0.0
            )

            if status == "ok" and p_selling_price > 0:
                status = "hidden"

            # Guardar cantidad específica en el lote
            batch_items_buffer.append(
                ImportBatchItem(
                    batch_id=current_batch_id,
                    product_id=p_id,
                    quantity=data["qty"],
                    stock_applied=False,
                )
            )

        else:
            # --- PRODUCTO NUEVO (Sin ID aleatorio) ---
            status = "new"
            seen_ids = set()
            has_blocked_sku = False

            if potential_codes:
                for db_prod in all_db_products:
                    for code in potential_codes:
                        if (
                            (clean_code(code) == clean_code(db_prod.sku))
                            or (clean_code(code) == clean_code(db_prod.upc))
                            or (code in (db_prod.name or ""))
                        ):
                            if db_prod.id not in seen_ids:
                                suggestions.append(
                                    {
                                        "id": db_prod.id,
                                        "name": db_prod.name,
                                        "price": db_prod.price,
                                    }
                                )
                                seen_ids.add(db_prod.id)
                                if sku_from_description and clean_code(code) == xml_sku:
                                    has_blocked_sku = True

            matches = difflib.get_close_matches(
                xml_name_norm, fuzzy_keys, n=5, cutoff=0.3
            )
            for m in matches:
                mp = name_map[m]
                if mp.id not in seen_ids:
                    suggestions.append(
                        {"id": mp.id, "name": mp.name, "price": mp.price}
                    )
                    seen_ids.add(mp.id)

            # Lógica SKU: Usar SKU del XML, o UPC, o dejar vacío. NUNCA inventar.
            final_sku = xml_sku
            if sku_from_description and has_blocked_sku:
                final_sku = ""
            if not final_sku and potential_codes:
                final_sku = potential_codes[0]
            if sku_from_description and final_sku and clean_code(final_sku) in sku_map:
                final_sku = ""
            if not final_sku and data.get("upc"):
                final_sku = data.get("upc")
            # Evitar SKU duplicado (UNIQUE): ya en BD o ya usado por otro
            # producto nuevo de este mismo lote.
            if final_sku and clean_code(final_sku) in used_skus:
                final_sku = None
            final_sku = final_sku or None
            if final_sku:
                used_skus.add(clean_code(final_sku))

            new_p = Product(
                sku=final_sku,
                upc=data.get("upc"),
                name=data["name"],
                price=data["cost"],
                stock_quantity=0,
                selling_price=0.0,
                supplier_id=supplier_id,
                origin="imported",
            )
            new_products_buffer.append(new_p)

            # Guardamos en memoria temporal para procesar después del flush
            temp_new_products_map.append(
                {
                    "product_obj": new_p,
                    "cost": data["cost"],
                    "qty": data["qty"],
                    "response_idx": len(final_response_data),
                    "saved_sku": final_sku,  # Guardamos el SKU aquí
                    "saved_upc": data.get("upc"),  # Guardamos el UPC aquí
                }
            )

        final_response_data.append(
            {
                "id": p_id,
                "name": data["name"],
                "qty": data["qty"],
                "cost": data["cost"],
                "cost_with_tax": data["cost_tax"],
                "old_cost": old_cost,
                "selling_price": float(p_selling_price),
                "sku": (
                    str(existing_product.sku)
                    if existing_product and existing_product.sku
                    else ""
                ),
                "upc": (
                    str(existing_product.upc)
                    if existing_product and existing_product.upc
                    else ""
                ),
                "status": status,
                "suggestions": suggestions,
            }
        )

    # 7. Guardado Masivo
    if new_products_buffer:
        db.add_all(new_products_buffer)
        await db.flush()  # Obtenemos IDs de productos nuevos

    # Procesar los nuevos usando los datos en memoria (evita ir a BD y causar error Greenlet)
    for item in temp_new_products_map:
        new_p = item["product_obj"]
        idx = item["response_idx"]
        price_history_buffer.append(
            PriceHistory(
                product_id=new_p.id,
                change_type="COSTO",
                old_value=0,
                new_value=item["cost"],
            )
        )
        batch_items_buffer.append(
            ImportBatchItem(
                batch_id=current_batch_id,
                product_id=new_p.id,
                quantity=item["qty"],
                stock_applied=False,
            )
        )

        # Actualizamos la respuesta con los datos de memoria
        final_response_data[idx]["id"] = new_p.id
        final_response_data[idx]["sku"] = (
            str(item["saved_sku"]) if item["saved_sku"] else ""
        )
        final_response_data[idx]["upc"] = (
            str(item["saved_upc"]) if item["saved_upc"] else ""
        )

    db.add_all(price_history_buffer)
    db.add_all(batch_items_buffer)

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Error DB: {str(e)}")

    final_response_data.sort(
        key=lambda x: (
            0 if x["status"] == "price_changed" else 1 if x["status"] == "new" else 2
        )
    )

    return {
        "status": "success",
        "message": "Procesado correctamente",
        "products": final_response_data,
        "hidden_count": len(grouped_items) - len(final_response_data),
        "batch_id": current_batch_id,
    }


# --- 2. ACTUALIZAR PRECIOS ---
@router.post("/update-prices")
async def update_prices(
    updates: List[Dict] = Body(...), db: AsyncSession = Depends(get_db)
):
    count = 0
    for item in updates:
        p = None
        if item.get("id"):
            p = await db.get(Product, item["id"])

        if not p:
            res = await db.execute(select(Product).where(Product.name == item["name"]))
            p = res.scalar_one_or_none()

        if p:
            try:
                if "alias" in item:
                    new_alias = str(item["alias"]).strip()
                    p.alias = new_alias if new_alias else None
                if "selling_price" in item:
                    new_price = float(item["selling_price"])
                    if abs((p.selling_price or 0) - new_price) > 0.01:
                        db.add(
                            PriceHistory(
                                product_id=p.id,
                                change_type="PRECIO",
                                old_value=(p.selling_price or 0),
                                new_value=new_price,
                            )
                        )
                        p.selling_price = new_price
                if "upc" in item:
                    new_upc = str(item["upc"]).strip()
                    if new_upc and new_upc != (p.upc or ""):
                        p.upc = new_upc
                count += 1
            except:
                continue
    await db.commit()
    return {"message": f"{count} productos actualizados."}


# --- 3. OBTENER PRODUCTOS ---
@router.get("/products")
async def get_products(
    q: Optional[str] = None,
    missing_price: bool = False,
    only_delicate: bool = False,
    min_price: float = None,
    max_price: float = None,
    min_stock: int = None,
    in_stock: bool = False,  # Almacén: con existencia y proveedor con inventario
    supplier_id: Optional[int] = None,  # 0 = sin proveedor
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(
        Product,
        Supplier.name.label("supplier_name"),
        Supplier.manages_inventory.label("manages_inventory"),
    ).outerjoin(Supplier, Product.supplier_id == Supplier.id)

    # --- 2. LÓGICA DE BÚSQUEDA SIN ACENTOS ---
    if q:
        q_safe = escape_like(q[:200])  # Limitar longitud y escapar wildcards
        stmt = stmt.where(
            or_(
                func.unaccent(Product.name).ilike(func.unaccent(f"%{q_safe}%")),
                Product.sku.ilike(f"%{q_safe}%"),
                Product.upc.ilike(f"%{q_safe}%"),
                func.unaccent(Product.alias).ilike(func.unaccent(f"%{q_safe}%")),
            )
        )

    # --- Filtros Restantes ---
    if missing_price:
        stmt = stmt.where(
            or_(Product.selling_price == 0, Product.selling_price == None)
        )
    if only_delicate:
        stmt = stmt.where(Product.is_delicate == True)
    if min_price is not None:
        stmt = stmt.where(Product.selling_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.selling_price <= max_price)
    if min_stock is not None:
        stmt = stmt.where(
            Product.stock_quantity <= min_stock, Supplier.manages_inventory.is_(True)
        )
    if in_stock:
        stmt = stmt.where(
            Product.stock_quantity > 0, Supplier.manages_inventory.is_(True)
        )
    if supplier_id == 0:
        stmt = stmt.where(or_(Product.supplier_id == None, Product.supplier_id == 0))
    elif supplier_id is not None:
        stmt = stmt.where(Product.supplier_id == supplier_id)

    # --- Ordenamiento (whitelist de columnas permitidas) ---
    ALLOWED_SORT = {"id", "name", "price", "selling_price", "stock_quantity", "updated_at", "created_at", "sku"}
    if sort_by not in ALLOWED_SORT:
        sort_by = "id"
    if sort_order not in ("asc", "desc"):
        sort_order = "desc"
    sort_col = getattr(Product, sort_by, Product.id)

    stmt = stmt.order_by(
        sort_col.desc() if sort_order == "desc" else sort_col.asc()
    )

    # --- Conteo total (antes de limit/offset) ---
    subq = stmt.order_by(None).subquery()
    count_stmt = select(func.count(subq.c.id))
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # --- Paginación ---
    stmt = stmt.limit(min(limit, 500)).offset(max(offset, 0))

    # --- Ejecución ---
    rows = (await db.execute(stmt)).all()

    # Piezas por ubicación de los productos del almacén de esta página
    locations = {}
    managed_ids = [p.id for p, _, manages_inventory in rows if manages_inventory]
    if managed_ids:
        loc_rows = await db.execute(
            select(ProductLocation.product_id, Location.code, ProductLocation.quantity)
            .join(Location, ProductLocation.location_id == Location.id)
            .where(ProductLocation.product_id.in_(managed_ids))
            .order_by(Location.code.asc())
        )
        for product_id, code, quantity in loc_rows.all():
            locations.setdefault(product_id, []).append({"code": code, "quantity": quantity or 0})

    items = [
        {
            "id": p.id,
            "sku": p.sku,
            "upc": p.upc or "",
            "name": p.name,
            "alias": p.alias or "",
            "price": p.price,
            "selling_price": p.selling_price,
            # Sin gestión de inventario el stock no se lleva: no se muestra.
            "stock": p.stock_quantity if manages_inventory else None,
            "locations": locations.get(p.id, []),
            "supplier_id": p.supplier_id,
            "supplier_name": supplier_name or "",
            "image_url": p.image_url or "",
            "is_delicate": p.is_delicate or False,
            "notes": p.notes or "",
            "origin": p.origin or "imported",
        }
        for p, supplier_name, manages_inventory in rows
    ]

    return {"items": items, "total": total}


# --- 4. ACTUALIZAR INDIVIDUAL ---
@router.put("/products/{product_id}")
async def update_product_single(
    product_id: int, data: dict = Body(...), db: AsyncSession = Depends(get_db)
):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "No encontrado")
    try:
        if "sku" in data:
            new_sku = str(data["sku"]).strip() if data["sku"] else None
            if new_sku and new_sku != p.sku:
                dup = await db.execute(select(Product).where(Product.sku == new_sku))
                if dup.scalar_one_or_none():
                    raise HTTPException(400, f"SKU {new_sku} ya existe")
            p.sku = new_sku
        if "upc" in data and data["upc"]:
            p.upc = str(data["upc"]).strip()
        if "selling_price" in data:
            np = float(data["selling_price"])
            if abs((p.selling_price or 0) - np) > 0.01:
                db.add(
                    PriceHistory(
                        product_id=p.id,
                        change_type="PRECIO",
                        old_value=(p.selling_price or 0),
                        new_value=np,
                    )
                )
                p.selling_price = np
        if "supplier_id" in data:
            p.supplier_id = int(data["supplier_id"]) if data["supplier_id"] else None
        if "name" in data:
            # El nombre de un producto importado es la clave con la que se
            # reconcilia contra la factura del proveedor: editarlo generaría un
            # duplicado en la siguiente importación.
            if p.origin != "manual":
                raise HTTPException(
                    400,
                    "No se puede cambiar el nombre de un producto importado. Usa el alias.",
                )
            new_name = str(data["name"]).strip() if data["name"] else ""
            if not new_name:
                raise HTTPException(400, "El nombre no puede quedar vacío")
            if new_name.lower() != (p.name or "").lower():
                dup = await db.execute(
                    select(Product).where(
                        func.lower(Product.name) == new_name.lower(),
                        Product.id != p.id,
                    )
                )
                if dup.scalar_one_or_none():
                    raise HTTPException(400, f"Ya existe un producto llamado {new_name}")
            p.name = new_name
        if "alias" in data:
            p.alias = str(data["alias"]).strip() if data["alias"] else None
        if "image_url" in data:
            p.image_url = data["image_url"] if data["image_url"] else None
        if "is_delicate" in data:
            p.is_delicate = bool(data["is_delicate"])
        if "notes" in data:
            p.notes = str(data["notes"] or "").strip() or None
        await db.commit()
        await db.refresh(p)
        return {"msg": "Actualizado", "id": p.id, "new_price": p.selling_price}
    except Exception as e:
        await db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(500, detail=str(e))


# --- 5. FUSIONAR ---
@router.post("/merge")
async def merge_products(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_admin),
):
    keep_id = data.get("keep_id")
    discard_id = data.get("discard_id")

    res_k = await db.execute(select(Product).where(Product.id == keep_id))
    k = res_k.scalar_one_or_none()

    res_d = await db.execute(select(Product).where(Product.id == discard_id))
    d = res_d.scalar_one_or_none()

    if not k or not d:
        raise HTTPException(404, "Producto no encontrado")

    price_discard = d.price
    price_keep = k.price
    new_price = price_keep
    if price_discard > 0 and price_keep == 0:
        new_price = price_discard

    await db.execute(
        update(ImportBatchItem)
        .where(ImportBatchItem.product_id == discard_id)
        .values(product_id=keep_id)
    )
    await db.execute(
        update(PriceHistory)
        .where(PriceHistory.product_id == discard_id)
        .values(product_id=keep_id)
    )
    await db.execute(
        update(Product)
        .where(Product.id == keep_id)
        .values(price=new_price, updated_at=datetime.now())
    )

    # Las piezas en ubicaciones pasan al producto que se queda
    kept_locations = {
        pl.location_id: pl
        for pl in (
            await db.execute(select(ProductLocation).where(ProductLocation.product_id == keep_id))
        ).scalars().all()
    }
    for pl in (
        await db.execute(select(ProductLocation).where(ProductLocation.product_id == discard_id))
    ).scalars().all():
        if pl.location_id in kept_locations:
            kept_locations[pl.location_id].quantity = (kept_locations[pl.location_id].quantity or 0) + (pl.quantity or 0)
            await db.delete(pl)
        else:
            pl.product_id = keep_id
    await db.flush()
    await db.execute(delete(Product).where(Product.id == discard_id))
    if await supplier_manages_inventory(db, k.supplier_id):
        await sync_stock(db, k, "MERGE", f"merge:{discard_id}")

    await db.commit()
    return {"message": "Fusionado correctamente"}


# --- 6. HISTORIAL ---
@router.get("/products/{product_id}/history")
async def get_product_history(product_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(PriceHistory)
        .where(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.date.desc())
    )
    return [
        {"date": h.date, "type": h.change_type, "old": h.old_value, "new": h.new_value}
        for h in (await db.execute(stmt)).scalars().all()
    ]


# --- 7. MANUAL ---
@router.post("/products/manual")
async def create_manual(item: ManualProductSchema, db: AsyncSession = Depends(get_db)):
    norm = normalize_name(item.name)
    res = await db.execute(
        select(Product).where(func.lower(Product.name) == item.name.lower())
    )
    if res.scalar_one_or_none():
        raise HTTPException(400, "Nombre duplicado")
    # La existencia inicial de un producto del almacén se guarda en su ubicación
    stock = item.stock if await supplier_manages_inventory(db, item.supplier_id) else 0
    location = None
    if stock > 0:
        location = await db.get(Location, item.location_id) if item.location_id else None
        if not location:
            raise HTTPException(400, "Elige la ubicación donde quedan las piezas")
    new_p = Product(
        name=item.name,
        sku=item.sku,
        upc=item.upc,
        price=item.price,
        selling_price=item.selling_price,
        stock_quantity=0,
        supplier_id=item.supplier_id,
        origin="manual",
    )
    db.add(new_p)
    await db.flush()
    if location:
        await set_location_quantity(db, new_p, location, stock)
    await db.commit()
    await db.refresh(new_p)
    return {"message": "Creado", "id": new_p.id, "name": new_p.name, "sku": new_p.sku or ""}


# --- 8B. BULK TOUCH (actualizar updated_at masivo) ---
@router.post("/products/bulk-touch")
async def bulk_touch_products(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    ids = data.get("ids", [])
    if not ids:
        raise HTTPException(400, "No hay IDs")
    await db.execute(
        update(Product)
        .where(Product.id.in_(ids))
        .values(updated_at=datetime.now())
    )
    await db.commit()
    return {"updated": len(ids)}


# --- 8. ELIMINAR ---
@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_admin),
):
    # 1. Buscar el producto
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="No encontrado")

    # 2. LIMPIEZA DE DEPENDENCIAS ANTES DE BORRAR EL PRODUCTO

    # A) Eliminar registros en lotes de importación (Esto soluciona tu error actual)
    await db.execute(
        delete(ImportBatchItem).where(ImportBatchItem.product_id == product_id)
    )

    # B) Eliminar el historial de precios de este producto
    await db.execute(delete(PriceHistory).where(PriceHistory.product_id == product_id))

    # C) Historial de stock, listas de compras, categorías y ubicaciones
    for model in (StockHistory, ShoppingListItem, ProductCategory, ProductLocation):
        await db.execute(delete(model).where(model.product_id == product_id))

    # 3. Ahora sí, eliminar el producto de forma segura
    await db.delete(p)
    await db.commit()

    return {"message": "Producto eliminado correctamente"}


# --- 9. CATÁLOGO MASIVO ---
@router.post("/upload-catalog")
async def upload_catalog(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(verify_upload_permission),
):
    content = await file.read()
    new_batch = ImportBatch(filename=f"CATALOGO-{file.filename}")
    db.add(new_batch)
    await db.flush()
    try:
        root = ET.fromstring(content)
        ns = {
            "cfdi": "http://www.sat.gob.mx/cfd/4",
            "cfdi3": "http://www.sat.gob.mx/cfd/3",
        }
        items = root.findall(".//cfdi:Concepto", ns) or root.findall(
            ".//cfdi3:Concepto", ns
        )

        emisor_node = root.find(".//cfdi:Emisor", ns)
        if emisor_node is None:
            emisor_node = root.find(".//cfdi3:Emisor", ns)
        emisor_info = None
        if emisor_node is not None:
            emisor_info = {
                "rfc": emisor_node.get("Rfc", "").strip(),
                "nombre": emisor_node.get("Nombre", "").strip(),
            }
        supplier_id = await get_or_create_supplier(db, emisor_info)
        new_batch.supplier_id = supplier_id

        all_p = (await db.execute(select(Product))).scalars().all()
        sku_map = {clean_code(p.sku): p for p in all_p if p.sku}
        name_map = {normalize_name(p.name): p for p in all_p}
        fuzzy_keys = list(name_map.keys())

        count_new, count_upd = 0, 0
        for item in items:
            sku = item.get("NoIdentificacion", "").strip()
            desc = item.get("Descripcion", "").strip()
            try:
                price = float(item.get("ValorUnitario", 0))
            except:
                price = 0

            clean_xml_sku = clean_code(sku)
            extracted = extract_sku_from_text(desc)
            norm_desc = normalize_name(desc)

            match = sku_map.get(clean_xml_sku) if clean_xml_sku else None
            if not match and extracted and extracted in sku_map:
                extracted_candidate = sku_map[extracted]
                if names_are_similar(desc, extracted_candidate.name):
                    match = extracted_candidate
            if not match:
                match = name_map.get(norm_desc)
            if not match:
                fuzzy = difflib.get_close_matches(
                    norm_desc, fuzzy_keys, n=1, cutoff=0.85
                )
                if fuzzy:
                    match = name_map[fuzzy[0]]

            final_id = None
            if match:
                sku_to_save = sku if sku else extracted
                if not sku and sku_to_save and clean_code(sku_to_save) in sku_map:
                    sku_to_save = ""
                if not match.sku and sku_to_save:
                    match.sku = sku_to_save
                    sku_map[clean_code(sku_to_save)] = match
                match.price = price
                if supplier_id and not match.supplier_id:
                    match.supplier_id = supplier_id
                count_upd += 1
                final_id = match.id
            else:
                final_sku = sku if sku else extracted
                if not sku and final_sku and clean_code(final_sku) in sku_map:
                    final_sku = None
                new_p = Product(
                    sku=final_sku,
                    name=desc,
                    price=price,
                    stock_quantity=0,
                    selling_price=0.0,
                    supplier_id=supplier_id,
                    origin="imported",
                )
                db.add(new_p)
                await db.flush()
                count_new += 1
                final_id = new_p.id
                if final_sku:
                    sku_map[clean_code(final_sku)] = new_p
                name_map[norm_desc] = new_p
                fuzzy_keys.append(norm_desc)

            if final_id:
                db.add(ImportBatchItem(batch_id=new_batch.id, product_id=final_id))

        await db.commit()
        return {"message": "Carga OK", "created": count_new, "updated": count_upd}
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, str(e))


# --- 10. BATCHES ---
@router.put("/batches/{batch_id}")
async def update_batch(
    batch_id: int, data: BatchUpdateSchema, db: AsyncSession = Depends(get_db)
):
    batch = await db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    batch.filename = data.filename
    await db.commit()
    return {"message": "Nombre actualizado"}


@router.delete("/batches/{batch_id}")
async def delete_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(verify_admin),
):
    """
    Borra una importación. Los productos permanecen en el catálogo (permite
    re-subir el XML limpio) y su existencia no cambia.
    """
    batch = await db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Importación no encontrada")

    # Las piezas del almacén viven en sus ubicaciones: borrar la factura no
    # mueve la existencia (se corrige en la ubicación).
    await db.execute(
        delete(ImportBatchItem).where(ImportBatchItem.batch_id == batch_id)
    )
    await db.delete(batch)

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Error DB: {str(e)}")

    return {"message": "Importación eliminada"}


@router.get("/batches")
async def get_batches(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            ImportBatch.id,
            ImportBatch.created_at,
            ImportBatch.filename,
            func.count(ImportBatchItem.id).label("total"),
            func.sum(
                case(
                    (or_(Product.selling_price == 0, Product.selling_price == None), 1),
                    else_=0,
                )
            ).label("pending"),
        )
        .select_from(ImportBatch)
        .outerjoin(ImportBatchItem, ImportBatch.id == ImportBatchItem.batch_id)
        .outerjoin(Product, ImportBatchItem.product_id == Product.id)
        .group_by(ImportBatch.id, ImportBatch.created_at, ImportBatch.filename)
        .order_by(ImportBatch.created_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    return [
        {
            "id": r.id,
            "date": r.created_at,
            "filename": r.filename,
            "total": r.total or 0,
            "pending": r.pending or 0,
        }
        for r in result.all()
    ]


@router.get("/batches/{batch_id}")
async def get_batch(batch_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(ImportBatch, Supplier.name.label("supplier_name"))
        .outerjoin(Supplier, ImportBatch.supplier_id == Supplier.id)
        .where(ImportBatch.id == batch_id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    batch, supplier_name = row
    return {
        "id": batch.id,
        "date": batch.created_at,
        "filename": batch.filename,
        "supplier_id": batch.supplier_id,
        "supplier_name": supplier_name or "",
    }


@router.put("/batches/{batch_id}/supplier")
async def set_batch_supplier(
    batch_id: int,
    data: BatchSupplierSchema,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(verify_upload_permission),
):
    """
    Guarda el proveedor de la factura y lo aplica a sus productos.
    Sin overwrite solo llena los productos que no tienen proveedor.
    """
    batch = await db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    if data.supplier_id is not None:
        if not await db.get(Supplier, data.supplier_id):
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    batch.supplier_id = data.supplier_id

    updated = 0
    if data.supplier_id is not None:
        product_ids = select(ImportBatchItem.product_id).where(
            ImportBatchItem.batch_id == batch_id
        )
        stmt = update(Product).where(Product.id.in_(product_ids))
        if not data.overwrite:
            stmt = stmt.where(
                or_(Product.supplier_id == None, Product.supplier_id == 0)
            )
        result = await db.execute(
            stmt.values(supplier_id=data.supplier_id).execution_options(
                synchronize_session=False
            )
        )
        updated = result.rowcount or 0

    await db.commit()
    return {"message": "Proveedor actualizado", "updated": updated}


@router.get("/batches/{batch_id}/products")
async def get_batch_items(batch_id: int, db: AsyncSession = Depends(get_db)):
    """
    Versión MEJORADA: Trae el producto Y la cantidad específica de este lote.
    """
    # Hacemos un JOIN para traer el Producto y la columna 'quantity' de la tabla intermedia
    stmt = (
        select(
            Product,
            ImportBatchItem.quantity.label(
                "batch_qty"
            ),  # <--- Aquí recuperamos el dato guardado
            Supplier.name.label("supplier_name"),
            Supplier.manages_inventory.label("manages_inventory"),
        )
        .join(ImportBatchItem, ImportBatchItem.product_id == Product.id)
        .outerjoin(Supplier, Product.supplier_id == Supplier.id)
        .where(ImportBatchItem.batch_id == batch_id)
    )

    result = await db.execute(stmt)
    rows = result.all()  # Esto nos da una lista de parejas: (Producto, Cantidad)

    return [
        {
            "id": p.id,
            "sku": p.sku,
            "upc": p.upc,
            "name": p.name,
            "alias": p.alias or "",
            "price": p.price,
            "selling_price": p.selling_price,
            # Stock total global; sin gestión de inventario no se muestra
            "stock": p.stock_quantity if manages_inventory else None,
            "quantity": (
                batch_qty if batch_qty is not None else 0
            ),  # <--- Enviamos la cantidad al Frontend
            "missing_price": (
                True if (not p.selling_price or p.selling_price <= 0) else False
            ),
            "supplier_id": p.supplier_id,
            "supplier_name": supplier_name or "",
        }
        for p, batch_qty, supplier_name, manages_inventory in rows
    ]
