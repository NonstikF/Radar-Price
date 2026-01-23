import hashlib
import difflib
import logging
import xml.etree.ElementTree as ET
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_ 
from typing import List, Dict, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.services.xml_service import XmlInvoiceParser
# --- IMPORTANTE: Agregamos los modelos nuevos ---
from app.domain.models import Product, PriceHistory, ImportBatch, ImportBatchItem 

# Configuración de logs
logger = logging.getLogger(__name__)

router = APIRouter()
parser = XmlInvoiceParser()

# --- ESQUEMAS DE DATOS ---
class ManualProductSchema(BaseModel):
    name: str
    sku: Optional[str] = None
    upc: Optional[str] = None
    price: float = 0.0        
    selling_price: float = 0.0 
    stock: int = 0

# --- UTILIDADES ---
def generate_unique_sku(name: str, sat_code: str) -> str:
    hash_object = hashlib.md5(name.encode())
    hex_dig = hash_object.hexdigest()
    prefix = "".join(filter(str.isalpha, name))[:3].upper() or "GEN"
    return f"{prefix}-{hex_dig[:6]}".upper()

# --- 1. SUBIDA XML ESTÁNDAR (CON REGISTRO DE LOTE) ---
@router.post("/upload")
async def upload_invoice(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not (file.filename.endswith(".xml") or file.content_type in ["text/xml", "application/xml"]):
        raise HTTPException(status_code=400, detail="El archivo debe ser un XML")

    content = await file.read()
    try:
        extracted_items = await parser.extract_data(content, db)
    except Exception as e:
        logger.error(f"Error parseando XML: {e}")
        raise HTTPException(status_code=500, detail=f"Error leyendo XML: {str(e)}")

    # --- NUEVO: CREAR EL REGISTRO DEL LOTE ---
    new_batch = ImportBatch(filename=file.filename)
    db.add(new_batch)
    await db.flush() # Obtenemos el ID del batch

    stmt = select(Product)
    result = await db.execute(stmt)
    all_db_products = result.scalars().all()
    
    db_product_map = {p.name.strip(): p for p in all_db_products}
    all_product_names = list(db_product_map.keys())

    grouped_items = {}
    for item in extracted_items:
        clean_name = item['name'].strip()
        key = f"{item['sku']}-{clean_name}"
        if key in grouped_items:
            grouped_items[key]['qty'] += item['quantity']
            grouped_items[key]['total_line'] += item['total_line']
        else:
            grouped_items[key] = {
                'sku': item['sku'],
                'name': clean_name,
                'qty': item['quantity'],
                'cost': item['unit_price_no_tax'],
                'cost_tax': item['unit_price_with_tax'],
                'total_line': item['total_line']
            }

    processed_data = []
    
    for key, data in grouped_items.items():
        existing_product = db_product_map.get(data['name'])
        status = "ok" 
        suggestions = []
        final_db_id = None
        old_cost = 0.0

        if existing_product:
            final_db_id = existing_product.id
            old_cost = existing_product.price
            
            if abs(existing_product.price - data['cost']) > 0.1:
                status = "price_changed"
                db.add(PriceHistory(
                    product_id=existing_product.id,
                    change_type="COSTO",
                    old_value=existing_product.price,
                    new_value=data['cost']
                ))
            
            has_selling_price = (existing_product.selling_price or 0) > 0
            if status == "ok" and has_selling_price:
                status = "hidden"

            existing_product.stock_quantity += data['qty']
            existing_product.price = data['cost']

        else:
            status = "new"
            matches = difflib.get_close_matches(data['name'], all_product_names, n=3, cutoff=0.6)
            for match_name in matches:
                match_prod = db_product_map[match_name]
                suggestions.append({"id": match_prod.id, "name": match_prod.name, "price": match_prod.price})

            unique_sku = generate_unique_sku(data['name'], data['sku'])
            new_product = Product(sku=unique_sku, name=data['name'], price=data['cost'], stock_quantity=data['qty'], selling_price=0.0)
            db.add(new_product)
            await db.flush()
            final_db_id = new_product.id
            
            db.add(PriceHistory(product_id=new_product.id, change_type="COSTO", old_value=0, new_value=data['cost']))

        # --- NUEVO: VINCULAR PRODUCTO AL LOTE ---
        if final_db_id:
            batch_item = ImportBatchItem(batch_id=new_batch.id, product_id=final_db_id)
            db.add(batch_item)

        if status != "hidden":
            processed_data.append({
                "id": final_db_id,
                "name": data['name'],
                "qty": data['qty'],
                "cost": data['cost'],
                "cost_with_tax": data['cost_tax'],
                "old_cost": old_cost,
                "selling_price": existing_product.selling_price if existing_product else 0.0,
                "sku": existing_product.sku if existing_product else "NUEVO",
                "status": status,
                "suggestions": suggestions
            })

    await db.commit()
    
    def sort_priority(item):
        if item['status'] == 'price_changed': return 0
        if item['status'] == 'new' and item['suggestions']: return 1
        if item['status'] == 'new': return 2
        return 3

    processed_data.sort(key=sort_priority)
    
    return {
        "message": "Procesado", 
        "products": processed_data, 
        "hidden_count": len(grouped_items) - len(processed_data)
    }

# --- 2. ACTUALIZAR PRECIOS (MASIVO) ---
@router.post("/update-prices")
async def update_prices(updates: List[Dict] = Body(...), db: AsyncSession = Depends(get_db)):
    count = 0
    for item in updates:
        stmt = select(Product).where(Product.name == item['name'])
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if product:
            try:
                new_price = float(item['selling_price'])
                current_price = product.selling_price or 0.0
                
                if abs(current_price - new_price) > 0.1:
                    db.add(PriceHistory(
                        product_id=product.id,
                        change_type="PRECIO",
                        old_value=current_price,
                        new_value=new_price
                    ))
                    product.selling_price = new_price
                    count += 1
            except: continue
            
    await db.commit()
    return {"message": f"{count} precios guardados."}

# --- 3. OBTENER PRODUCTOS ---
@router.get("/products")
async def get_products(
    q: Optional[str] = None, 
    missing_price: bool = False, 
    limit: int = 50, 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product)

    if missing_price:
        stmt = stmt.where(or_(Product.selling_price == 0, Product.selling_price == None))
    elif q:
        search_filter = f"%{q}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(search_filter),
                Product.sku.ilike(search_filter),
                Product.upc.ilike(search_filter)
            )
        )
    else:
        return []

    stmt = stmt.order_by(Product.name).limit(limit)
    
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    return [
        {
            "id": p.id, 
            "sku": p.sku, 
            "upc": p.upc or "", 
            "name": p.name, 
            "selling_price": p.selling_price, 
            "stock": p.stock_quantity
        } 
        for p in products
    ]

# --- 4. ACTUALIZAR PRODUCTO INDIVIDUAL ---
@router.put("/products/{product_id}")
async def update_product_single(product_id: int, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    
    if not product: 
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    try:
        if "sku" in data and data["sku"]: 
            product.sku = data["sku"]
        
        if "upc" in data and data["upc"]: 
            new_upc = str(data["upc"]).strip()
            stmt_dup = select(Product).where(Product.upc == new_upc)
            result_dup = await db.execute(stmt_dup)
            duplicate = result_dup.scalar_one_or_none()

            if duplicate and duplicate.id != product_id:
                raise HTTPException(
                    status_code=400, 
                    detail=f"El código '{new_upc}' ya está en uso por: {duplicate.name}"
                )
            product.upc = new_upc

        if "selling_price" in data:
            new_price = float(data["selling_price"])
            old_price = product.selling_price or 0.0

            if abs(new_price - old_price) > 0.01:
                product.selling_price = new_price
                db.add(PriceHistory(
                    product_id=product.id,
                    change_type="PRECIO",
                    old_value=old_price,
                    new_value=new_price
                ))

        await db.commit()
        await db.refresh(product)
        return {"msg": "Actualizado correctamente", "id": product.id, "new_price": product.selling_price}

    except HTTPException as he:
        raise he 
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formato inválido: {str(e)}")
    except Exception as e:
        logger.error(f"Error crítico actualizando producto {product_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# --- 5. FUSIONAR PRODUCTOS ---
@router.post("/merge")
async def merge_products(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    keep_id = data.get("keep_id")
    discard_id = data.get("discard_id")
    
    keep_prod = (await db.execute(select(Product).where(Product.id == keep_id))).scalar_one_or_none()
    discard_prod = (await db.execute(select(Product).where(Product.id == discard_id))).scalar_one_or_none()
    
    if not keep_prod or not discard_prod: raise HTTPException(404, "Producto no encontrado")

    keep_prod.stock_quantity += discard_prod.stock_quantity
    keep_prod.price = discard_prod.price 
    
    await db.delete(discard_prod)
    await db.commit()
    return {"message": "Fusionado"}

# --- 6. HISTORIAL DE PRECIOS ---
@router.get("/products/{product_id}/history")
async def get_product_history(product_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(PriceHistory).where(PriceHistory.product_id == product_id).order_by(PriceHistory.date.desc())
    result = await db.execute(stmt)
    history = result.scalars().all()
    return [{
        "date": h.date,
        "type": h.change_type,
        "old": h.old_value,
        "new": h.new_value
    } for h in history]

# --- 7. CREAR MANUAL ---
@router.post("/products/manual")
async def create_manual_product(item: ManualProductSchema, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.name == item.name)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un producto con este nombre.")

    final_sku = item.sku.strip() if item.sku and item.sku.strip() else None
    
    if final_sku:
        stmt_sku = select(Product).where(Product.sku == final_sku)
        if (await db.execute(stmt_sku)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"El SKU '{final_sku}' ya existe.")

    if item.upc:
        clean_upc = item.upc.strip()
        stmt_upc = select(Product).where(Product.upc == clean_upc)
        duplicate = (await db.execute(stmt_upc)).scalar_one_or_none()
        if duplicate:
            raise HTTPException(
                status_code=400, 
                detail=f"El código '{clean_upc}' ya está asignado a: {duplicate.name}"
            )

    new_product = Product(
        sku=final_sku,
        upc=item.upc,
        name=item.name,
        price=item.price,
        selling_price=item.selling_price,
        stock_quantity=item.stock
    )
    db.add(new_product)
    await db.flush()

    if item.price > 0:
        db.add(PriceHistory(product_id=new_product.id, change_type="COSTO", old_value=0, new_value=item.price))
    if item.selling_price > 0:
        db.add(PriceHistory(product_id=new_product.id, change_type="PRECIO", old_value=0, new_value=item.selling_price))

    await db.commit()
    return {"message": "Producto creado", "sku": final_sku}

# --- 8. ELIMINAR PRODUCTO ---
@router.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    try:
        await db.execute(select(PriceHistory).where(PriceHistory.product_id == product_id))
        await db.delete(product)
        await db.commit()
        return {"message": "Producto eliminado correctamente"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar: {str(e)}")

# --- 9. IMPORTACIÓN ESPECIAL DE CATÁLOGO ---
@router.post("/upload-catalog")
async def upload_special_catalog(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not (file.filename.endswith(".xml") or file.content_type in ["text/xml", "application/xml"]):
        raise HTTPException(status_code=400, detail="El archivo debe ser un XML")

    content = await file.read()
    
    # --- NUEVO: CREAR LOTE PARA CATALOGO TAMBIÉN ---
    new_batch = ImportBatch(filename=f"CATALOGO-{file.filename}")
    db.add(new_batch)
    await db.flush()

    try:
        root = ET.fromstring(content)
        namespaces = {
            'cfdi': 'http://www.sat.gob.mx/cfd/4',
            'cfdi3': 'http://www.sat.gob.mx/cfd/3' 
        }
        
        conceptos = root.findall('.//cfdi:Concepto', namespaces)
        if not conceptos:
            conceptos = root.findall('.//cfdi3:Concepto', namespaces)

        count_new = 0
        count_updated = 0

        for item in conceptos:
            xml_upc = item.get('ClaveProdServ', '').strip()
            xml_sku = item.get('NoIdentificacion', '').strip()
            description = item.get('Descripcion', '').strip()
            try:
                price_cost = float(item.get('ValorUnitario', 0))
                qty = float(item.get('Cantidad', 0))
            except:
                price_cost = 0.0
                qty = 0

            if not xml_sku:
                continue 

            stmt = select(Product).where(Product.sku == xml_sku)
            result = await db.execute(stmt)
            existing_prod = result.scalar_one_or_none()
            
            final_prod_id = None

            if existing_prod:
                final_prod_id = existing_prod.id
                existing_prod.upc = xml_upc 
                existing_prod.stock_quantity += int(qty)
                
                if abs(existing_prod.price - price_cost) > 0.1:
                    db.add(PriceHistory(
                        product_id=existing_prod.id,
                        change_type="COSTO",
                        old_value=existing_prod.price,
                        new_value=price_cost
                    ))
                    existing_prod.price = price_cost
                count_updated += 1
            else:
                new_prod = Product(
                    sku=xml_sku,
                    upc=xml_upc,
                    name=description,
                    price=price_cost,
                    stock_quantity=int(qty),
                    selling_price=0.0
                )
                db.add(new_prod)
                await db.flush()
                final_prod_id = new_prod.id
                if price_cost > 0:
                    db.add(PriceHistory(product_id=new_prod.id, change_type="COSTO", old_value=0, new_value=price_cost))
                count_new += 1
            
            # --- GUARDAR EN LOTE ---
            if final_prod_id:
                db.add(ImportBatchItem(batch_id=new_batch.id, product_id=final_prod_id))

        await db.commit()
        return {
            "message": "Carga de catálogo completada",
            "created": count_new,
            "updated": count_updated
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error procesando catálogo: {str(e)}")

# --- 10. NUEVOS ENDPOINTS: HISTORIAL DE CARGAS (BATCHES) ---
@router.get("/batches")
async def get_import_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(20))
    batches = result.scalars().all()
    
    history_data = []
    for batch in batches:
        stmt_items = select(ImportBatchItem).where(ImportBatchItem.batch_id == batch.id)
        items_result = await db.execute(stmt_items)
        items = items_result.scalars().all()
        
        total_items = len(items)
        
        missing_price = 0
        for item in items:
            prod = await db.get(Product, item.product_id)
            if prod and (not prod.selling_price or prod.selling_price <= 0):
                missing_price += 1
                
        history_data.append({
            "id": batch.id,
            "date": batch.created_at,
            "filename": batch.filename,
            "total": total_items,
            "pending": missing_price
        })
        
    return history_data

@router.get("/batches/{batch_id}/products")
async def get_batch_products(batch_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(ImportBatchItem).where(ImportBatchItem.batch_id == batch_id)
    result = await db.execute(stmt)
    batch_items = result.scalars().all()
    
    product_ids = [item.product_id for item in batch_items]
    
    if not product_ids:
        return []

    stmt_prod = select(Product).where(Product.id.in_(product_ids))
    result_prod = await db.execute(stmt_prod)
    products = result_prod.scalars().all()
    
    return [
        {
            "id": p.id, 
            "sku": p.sku, 
            "upc": p.upc or "", 
            "name": p.name, 
            "selling_price": p.selling_price, 
            "stock": p.stock_quantity,
            "missing_price": True if (not p.selling_price or p.selling_price <= 0) else False
        } 
        for p in products
    ]