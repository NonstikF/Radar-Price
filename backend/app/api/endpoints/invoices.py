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
from app.services.xml_service import XmlInvoiceParser
from app.domain.models import Product, PriceHistory, ImportBatch, ImportBatchItem

logger = logging.getLogger(__name__)
router = APIRouter()
parser = XmlInvoiceParser()


# --- ESQUEMAS ---
class ManualProductSchema(BaseModel):
    name: str
    sku: Optional[str] = None
    upc: Optional[str] = None
    price: float = 0.0
    selling_price: float = 0.0
    stock: int = 0


class BatchUpdateSchema(BaseModel):
    filename: str


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


# --- 1. SUBIDA XML (MATCHING AGRESIVO) ---
@router.post("/upload")
async def upload_invoice(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
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
        extracted_items = await parser.extract_data(content, db)
    except Exception as e:
        logger.error(f"Error XML: {e}")
        raise HTTPException(500, f"Error leyendo estructura XML: {str(e)}")

    # 3. Crear Lote
    new_batch = ImportBatch(filename=file.filename, created_at=datetime.now())
    db.add(new_batch)
    await db.flush()
    current_batch_id = new_batch.id

    # 4. Cargar Inventario Actual
    stmt = select(Product)
    all_db_products = (await db.execute(stmt)).scalars().all()

    sku_map = {clean_code(p.sku): p for p in all_db_products if p.sku}
    upc_map = {clean_code(p.upc): p for p in all_db_products if p.upc}
    name_map = {normalize_name(p.name): p for p in all_db_products}
    fuzzy_keys = list(name_map.keys())

    # 5. Agrupar Items
    grouped_items = {}
    for item in extracted_items:
        key = item.get("sku") or item.get("name")
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
        xml_upc = clean_code(data.get("upc", ""))
        xml_name_norm = normalize_name(data["name"])
        potential_codes = extract_potential_codes(data["name"])

        # Búsqueda
        if xml_sku and xml_sku in sku_map:
            existing_product = sku_map[xml_sku]
        elif xml_upc and xml_upc in upc_map:
            existing_product = upc_map[xml_upc]
        elif xml_name_norm in name_map:
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
                existing_product.sku = sku_cand
            if not existing_product.upc and data.get("upc"):
                existing_product.upc = data.get("upc")

            existing_product.stock_quantity += data["qty"]  # Sumar Stock Global

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
                    batch_id=current_batch_id, product_id=p_id, quantity=data["qty"]
                )
            )

        else:
            # --- PRODUCTO NUEVO (Sin ID aleatorio) ---
            status = "new"
            seen_ids = set()

            if potential_codes:
                for db_prod in all_db_products:
                    for code in potential_codes:
                        if (
                            (code == db_prod.sku)
                            or (code == db_prod.upc)
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
            if not final_sku and potential_codes:
                final_sku = potential_codes[0]
            if not final_sku and data.get("upc"):
                final_sku = data.get("upc")

            new_p = Product(
                sku=final_sku,
                upc=data.get("upc"),
                name=data["name"],
                price=data["cost"],
                stock_quantity=data["qty"],
                selling_price=0.0,
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
                batch_id=current_batch_id, product_id=new_p.id, quantity=item["qty"]
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
    min_price: float = None,
    max_price: float = None,
    min_stock: int = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product)

    # --- 2. LÓGICA DE BÚSQUEDA SIN ACENTOS ---
    if q:
        # Usamos func.unaccent() tanto en la columna de la BD como en el texto de búsqueda
        # para que "blister" coincida con "Blíster".
        stmt = stmt.where(
            or_(
                func.unaccent(Product.name).ilike(func.unaccent(f"%{q}%")),
                Product.sku.ilike(f"%{q}%"),  # SKU y UPC no suelen llevar acentos
                Product.upc.ilike(f"%{q}%"),
            )
        )

    # --- Filtros Restantes ---
    if missing_price:
        stmt = stmt.where(
            or_(Product.selling_price == 0, Product.selling_price == None)
        )
    if min_price is not None:
        stmt = stmt.where(Product.selling_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.selling_price <= max_price)
    if min_stock is not None:
        stmt = stmt.where(Product.stock_quantity <= min_stock)

    # --- Ordenamiento ---
    sort_col = getattr(Product, sort_by, None)
    if sort_col is None:
        sort_col = Product.id

    stmt = stmt.order_by(
        sort_col.desc() if sort_order == "desc" else sort_col.asc()
    ).limit(limit)

    # --- Ejecución ---
    result = await db.execute(stmt)

    return [
        {
            "id": p.id,
            "sku": p.sku,
            "upc": p.upc or "",
            "name": p.name,
            "price": p.price,
            "selling_price": p.selling_price,
            "stock": p.stock_quantity,
        }
        for p in result.scalars().all()
    ]


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
async def merge_products(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    keep_id = data.get("keep_id")
    discard_id = data.get("discard_id")

    res_k = await db.execute(select(Product).where(Product.id == keep_id))
    k = res_k.scalar_one_or_none()

    res_d = await db.execute(select(Product).where(Product.id == discard_id))
    d = res_d.scalar_one_or_none()

    if not k or not d:
        raise HTTPException(404, "Producto no encontrado")

    qty_to_add = d.stock_quantity
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
        .values(stock_quantity=Product.stock_quantity + qty_to_add, price=new_price)
    )
    await db.execute(delete(Product).where(Product.id == discard_id))

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
    new_p = Product(
        name=item.name,
        sku=item.sku,
        upc=item.upc,
        price=item.price,
        selling_price=item.selling_price,
        stock_quantity=item.stock,
    )
    db.add(new_p)
    await db.commit()
    return {"message": "Creado"}


# --- 8. ELIMINAR ---
@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "No encontrado")
    await db.execute(select(PriceHistory).where(PriceHistory.product_id == product_id))
    await db.delete(p)
    await db.commit()
    return {"message": "Eliminado"}


# --- 9. CATÁLOGO MASIVO ---
@router.post("/upload-catalog")
async def upload_catalog(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
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
                qty = float(item.get("Cantidad", 0))
            except:
                price = 0
                qty = 0

            clean_xml_sku = clean_code(sku)
            extracted = extract_sku_from_text(desc)
            norm_desc = normalize_name(desc)

            match = (
                sku_map.get(clean_xml_sku)
                or sku_map.get(extracted)
                or name_map.get(norm_desc)
            )
            if not match:
                fuzzy = difflib.get_close_matches(
                    norm_desc, fuzzy_keys, n=1, cutoff=0.85
                )
                if fuzzy:
                    match = name_map[fuzzy[0]]

            final_id = None
            if match:
                sku_to_save = sku if sku else extracted
                if not match.sku and sku_to_save:
                    match.sku = sku_to_save
                    sku_map[clean_code(sku_to_save)] = match
                match.stock_quantity += int(qty)
                match.price = price
                count_upd += 1
                final_id = match.id
            else:
                final_sku = sku if sku else extracted
                new_p = Product(
                    sku=final_sku,
                    name=desc,
                    price=price,
                    stock_quantity=int(qty),
                    selling_price=0.0,
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


@router.get("/batches/{batch_id}/products")
async def get_batch_items(batch_id: int, db: AsyncSession = Depends(get_db)):
    ids_stmt = select(ImportBatchItem.product_id).where(
        ImportBatchItem.batch_id == batch_id
    )
    ids = (await db.execute(ids_stmt)).scalars().all()
    if not ids:
        return []
    prods = (
        (await db.execute(select(Product).where(Product.id.in_(ids)))).scalars().all()
    )
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "upc": p.upc,
            "name": p.name,
            "price": p.price,
            "selling_price": p.selling_price,
            "stock": p.stock_quantity,
            "missing_price": (
                True if (not p.selling_price or p.selling_price <= 0) else False
            ),
        }
        for p in prods
    ]
