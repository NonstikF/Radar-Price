import hashlib
import difflib
import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.services.xml_service import XmlInvoiceParser
from app.domain.models import Product, PriceHistory

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

# --- 1. SUBIDA XML ---
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
async def get_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).order_by(Product.name))
    return [{"id": p.id, "sku": p.sku, "upc": p.upc or "", "name": p.name, "selling_price": p.selling_price, "stock": p.stock_quantity} for p in result.scalars().all()]

# --- 4. ACTUALIZAR PRODUCTO INDIVIDUAL (CON VALIDACIÓN DE DUPLICADOS) ---
@router.put("/products/{product_id}")
async def update_product_single(product_id: int, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    # Buscar producto
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    
    if not product: 
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    try:
        # --- VALIDAR Y ACTUALIZAR SKU ---
        if "sku" in data and data["sku"]: 
            product.sku = data["sku"]
        
        # --- 🔍 VALIDACIÓN ANTI-DUPLICADOS PARA UPC ---
        if "upc" in data and data["upc"]: 
            new_upc = str(data["upc"]).strip()
            
            # Buscamos si existe OTRO producto con este mismo UPC
            stmt_dup = select(Product).where(Product.upc == new_upc)
            result_dup = await db.execute(stmt_dup)
            duplicate = result_dup.scalar_one_or_none()

            # Si existe y NO es el mismo que estamos editando... ERROR
            if duplicate and duplicate.id != product_id:
                raise HTTPException(
                    status_code=400, 
                    detail=f"El código '{new_upc}' ya está en uso por: {duplicate.name}"
                )
            
            product.upc = new_upc

        # --- ACTUALIZAR PRECIO DE VENTA ---
        if "selling_price" in data:
            new_price = float(data["selling_price"])
            old_price = product.selling_price or 0.0

            if abs(new_price - old_price) > 0.01:
                product.selling_price = new_price
                # Crear Historial
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
        raise he # Re-lanzar error de duplicado para que el frontend lo vea
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

# --- 6. HISTORIAL ---
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

# --- 7. CREAR MANUAL (CON VALIDACIÓN DE DUPLICADOS) ---
@router.post("/products/manual")
async def create_manual_product(item: ManualProductSchema, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.name == item.name)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un producto con este nombre.")

    final_sku = item.sku
    if not final_sku:
        final_sku = generate_unique_sku(item.name, "MANUAL")
    
    # Validar SKU único
    stmt_sku = select(Product).where(Product.sku == final_sku)
    if (await db.execute(stmt_sku)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"El SKU '{final_sku}' ya existe.")

    # 🔍 VALIDACIÓN ANTI-DUPLICADOS PARA UPC (NUEVO PRODUCTO)
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