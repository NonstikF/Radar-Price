import hashlib
import difflib
import logging
import re
import unicodedata
import xml.etree.ElementTree as ET
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func, case
from typing import List, Dict, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.services.xml_service import XmlInvoiceParser
from app.domain.models import Product, PriceHistory, ImportBatch, ImportBatchItem

# Configuración de logs
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


# --- UTILIDADES DE ALTO RENDIMIENTO ---


def normalize_name(text: str) -> str:
    """Limpieza rápida de texto para comparaciones."""
    if not text:
        return ""
    text = str(text).lower()
    text = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    text = text.replace("(", " ").replace(")", " ").replace("-", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_code(code: str) -> str:
    """Limpieza de códigos (SKU/UPC) eliminando caracteres basura."""
    if not code:
        return ""
    return re.sub(r"[\W_]+", "", str(code).upper())


def extract_sku_from_text(text: str) -> Optional[str]:
    """
    Extracción optimizada de SKU (Lógica Truper) usando Regex compilado.
    """
    if not text:
        return None
    # Patrón 1: Código entre paréntesis (ej: Truper (10234))
    match = re.search(r"\((\d{4,6})\)", text)
    if match:
        return match.group(1)
    # Patrón 2: Código de 5 dígitos al final
    match_end = re.search(r"\b(\d{5})$", text.strip())
    if match_end:
        return match_end.group(1)
    return None


# --- 1. SUBIDA XML OPTIMIZADA ---
@router.post("/upload")
async def upload_invoice(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    if not (
        file.filename.endswith(".xml")
        or file.content_type in ["text/xml", "application/xml"]
    ):
        raise HTTPException(status_code=400, detail="Debe ser XML")

    # 🚀 1. CHECK RÁPIDO DE DUPLICADOS (Sin procesar nada si ya existe)
    stmt_check = select(ImportBatch).where(ImportBatch.filename == file.filename)
    result_check = await db.execute(stmt_check)
    existing_batch = result_check.scalars().first()

    if existing_batch:
        return {
            "status": "exists",
            "message": "Archivo ya procesado anteriormente.",
            "batch_id": existing_batch.id,
            "filename": existing_batch.filename,
            "uploaded_at": existing_batch.created_at,
        }

    # Procesamiento del archivo
    content = await file.read()
    try:
        extracted_items = await parser.extract_data(content, db)
    except Exception as e:
        logger.error(f"Error XML: {e}")
        raise HTTPException(500, f"Error leyendo XML: {str(e)}")

    # Crear registro del Lote
    new_batch = ImportBatch(filename=file.filename)
    db.add(new_batch)
    await db.flush()

    # 🚀 2. CARGA EFICIENTE EN MEMORIA
    stmt = select(Product)
    all_db_products = (await db.execute(stmt)).scalars().all()

    sku_map = {}
    upc_map = {}
    name_map = {}

    for p in all_db_products:
        if p.sku:
            sku_map[clean_code(p.sku)] = p
        if p.upc:
            upc_map[clean_code(p.upc)] = p
        name_map[normalize_name(p.name)] = p

    fuzzy_keys = list(name_map.keys())

    grouped_items = {}
    for item in extracted_items:
        key = item["sku"] if item["sku"] else item["name"]
        if key in grouped_items:
            grouped_items[key]["qty"] += item["quantity"]
            grouped_items[key]["total_line"] += item["total_line"]
        else:
            grouped_items[key] = {
                "sku": item["sku"],
                "upc": item.get("upc", ""),
                "name": item["name"],
                "qty": item["quantity"],
                "cost": item["unit_price_no_tax"],
                "cost_tax": item["unit_price_with_tax"],
            }

    processed_data = []

    for key, data in grouped_items.items():
        existing_product = None

        xml_sku = clean_code(data["sku"])
        xml_upc = clean_code(data.get("upc", ""))
        xml_name_norm = normalize_name(data["name"])
        extracted_sku = extract_sku_from_text(data["name"])

        # Estrategia de búsqueda
        if xml_sku and xml_sku in sku_map:
            existing_product = sku_map[xml_sku]
        elif xml_upc and xml_upc in upc_map:
            existing_product = upc_map[xml_upc]
        elif extracted_sku and extracted_sku in sku_map:
            existing_product = sku_map[extracted_sku]
        elif xml_name_norm in name_map:
            existing_product = name_map[xml_name_norm]

        if not existing_product:
            matches = difflib.get_close_matches(
                xml_name_norm, fuzzy_keys, n=1, cutoff=0.85
            )
            if matches:
                existing_product = name_map[matches[0]]

        status = "ok"
        suggestions = []
        final_db_id = None
        old_cost = 0.0

        if existing_product:
            final_db_id = existing_product.id
            old_cost = existing_product.price

            # Actualizar SKU si lo encontramos por otra vía
            sku_cand = xml_sku or extracted_sku
            if sku_cand and not existing_product.sku:
                existing_product.sku = sku_cand
                sku_map[sku_cand] = existing_product

            if not existing_product.upc and data.get("upc"):
                existing_product.upc = data.get("upc")

            if abs(existing_product.price - data["cost"]) > 0.1:
                status = "price_changed"
                db.add(
                    PriceHistory(
                        product_id=existing_product.id,
                        change_type="COSTO",
                        old_value=existing_product.price,
                        new_value=data["cost"],
                    )
                )

            if status == "ok" and (existing_product.selling_price or 0) > 0:
                status = "hidden"

            existing_product.stock_quantity += data["qty"]
            existing_product.price = data["cost"]

        else:
            status = "new"
            matches = difflib.get_close_matches(
                xml_name_norm, fuzzy_keys, n=3, cutoff=0.6
            )
            for m in matches:
                mp = name_map[m]
                suggestions.append({"id": mp.id, "name": mp.name, "price": mp.price})

            final_sku = xml_sku if xml_sku else extracted_sku

            new_prod = Product(
                sku=final_sku,
                upc=data.get("upc"),
                name=data["name"],
                price=data["cost"],
                stock_quantity=data["qty"],
                selling_price=0.0,
            )
            db.add(new_prod)
            await db.flush()
            final_db_id = new_prod.id

            if final_sku:
                sku_map[final_sku] = new_prod
            name_map[xml_name_norm] = new_prod
            fuzzy_keys.append(xml_name_norm)

            db.add(
                PriceHistory(
                    product_id=new_prod.id,
                    change_type="COSTO",
                    old_value=0,
                    new_value=data["cost"],
                )
            )

        if final_db_id:
            db.add(ImportBatchItem(batch_id=new_batch.id, product_id=final_db_id))

        if status != "hidden":
            processed_data.append(
                {
                    "id": final_db_id,
                    "name": data["name"],
                    "qty": data["qty"],
                    "cost": data["cost"],
                    "cost_with_tax": data["cost_tax"],
                    "old_cost": old_cost,
                    "selling_price": existing_product.selling_price
                    if existing_product
                    else 0.0,
                    "sku": existing_product.sku
                    if (existing_product and existing_product.sku)
                    else "",
                    "status": status,
                    "suggestions": suggestions,
                }
            )

    await db.commit()
    processed_data.sort(
        key=lambda x: 0
        if x["status"] == "price_changed"
        else 1
        if x["status"] == "new"
        else 2
    )

    return {
        "status": "success",
        "message": "Procesado correctamente",
        "products": processed_data,
        "hidden_count": len(grouped_items) - len(processed_data),
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

        # Fallback por nombre
        if not p:
            res = await db.execute(select(Product).where(Product.name == item["name"]))
            p = res.scalar_one_or_none()

        if p:
            try:
                # 1. Actualizar Precio Venta
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

                # 2. Actualizar UPC (NUEVO)
                if "upc" in item:
                    new_upc = str(item["upc"]).strip()
                    # Solo actualizamos si es diferente y no está vacío
                    if new_upc and new_upc != (p.upc or ""):
                        p.upc = new_upc

                count += 1
            except:
                continue

    await db.commit()
    return {"message": f"{count} productos actualizados."}


# --- 3. OBTENER PRODUCTOS (MODIFICADO: ÚLTIMOS 50 MODIFICADOS) ---
@router.get("/products")
async def get_products(
    q: Optional[str] = None,
    missing_price: bool = False,
    min_price: float = None,
    max_price: float = None,
    min_stock: int = None,
    # 👇 CAMBIOS AQUÍ: Valores por defecto para "Últimos 50 modificados"
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product)

    if q:
        search_filter = f"%{q}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(search_filter),
                Product.sku.ilike(search_filter),
                Product.upc.ilike(search_filter),
            )
        )

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

    # 👇 LÓGICA MEJORADA DE ORDENAMIENTO
    # Intentamos ordenar por lo que pide el usuario ('updated_at' por defecto).
    # Si el modelo Product no tiene ese campo, usamos 'id' (últimos creados) como fallback seguro.
    sort_col = getattr(Product, sort_by, None)
    if sort_col is None:
        sort_col = Product.id  # Fallback a ID si 'updated_at' no existe

    # Aplicar orden (descendente por defecto para ver los últimos)
    stmt = stmt.order_by(
        sort_col.desc() if sort_order == "desc" else sort_col.asc()
    ).limit(limit)

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
    k = await db.get(Product, data.get("keep_id"))
    d = await db.get(Product, data.get("discard_id"))
    if not k or not d:
        raise HTTPException(404, "Producto no encontrado")
    k.stock_quantity += d.stock_quantity
    if d.price > 0:
        k.price = d.price
    await db.delete(d)
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


# --- ESQUEMA PARA RENOMBRAR ---
class BatchUpdateSchema(BaseModel):
    filename: str


# --- ENDPOINT PARA RENOMBRAR LOTE ---
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


# --- 10. BATCHES (ULTRA RÁPIDO) ---
@router.get("/batches")
async def get_batches(db: AsyncSession = Depends(get_db)):
    """
    Obtiene el historial agrupando todo en una sola consulta SQL.
    Evita el bucle N+1 que ralentiza el sistema.
    """
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
    rows = result.all()

    return [
        {
            "id": r.id,
            "date": r.created_at,
            "filename": r.filename,
            "total": r.total or 0,
            "pending": r.pending or 0,
        }
        for r in rows
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
            "missing_price": True
            if (not p.selling_price or p.selling_price <= 0)
            else False,
        }
        for p in prods
    ]
