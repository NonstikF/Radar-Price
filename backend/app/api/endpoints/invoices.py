import hashlib
# import difflib # Comentado por rendimiento en archivos grandes
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.services.xml_service import XmlInvoiceParser
from app.domain.models import Product, PriceHistory

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

# --- 1. SUBIDA XML OPTIMIZADA (BULK INSERT) ---
@router.post("/upload")
async def upload_invoice(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not (file.filename.endswith(".xml") or file.content_type in ["text/xml", "application/xml"]):
        raise HTTPException(status_code=400, detail="El archivo debe ser un XML")

    content = await file.read()
    try:
        extracted_items = await parser.extract_data(content, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 1. Cargar productos existentes en memoria (Rápido para ~50k items)
    stmt = select(Product)
    result = await db.execute(stmt)
    all_db_products = result.scalars().all()
    
    # Diccionario para búsqueda instantánea O(1)
    db_product_map = {p.name.strip(): p for p in all_db_products}
    
    # 2. Agrupar items del XML para evitar duplicados en el mismo archivo
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

    # Listas para operaciones masivas (Bulk)
    new_products_list = []     # Objetos Product nuevos
    history_entries = []       # Objetos PriceHistory
    processed_response = []    # Datos para devolver al Frontend
    
    # Diccionario temporal para conectar historial con productos nuevos
    # Clave: Nombre producto, Valor: Costo inicial
    new_products_cost_map = {} 

    # 3. Procesar lógica (Sin tocar la DB todavía)
    for key, data in grouped_items.items():
        existing_product = db_product_map.get(data['name'])
        status = "ok"
        suggestions = []
        
        if existing_product:
            # --- PRODUCTO EXISTENTE ---
            old_cost = existing_product.price
            
            # Detectar cambio de costo
            if abs(existing_product.price - data['cost']) > 0.1:
                status = "price_changed"
                # Añadir a lista de historial
                history_entries.append(PriceHistory(
                    product_id=existing_product.id,
                    change_type="COSTO",
                    old_value=existing_product.price,
                    new_value=data['cost']
                ))
            
            # Filtro visual
            has_selling_price = (existing_product.selling_price or 0) > 0
            if status == "ok" and has_selling_price:
                status = "hidden"

            # Actualizar objeto (SQLAlchemy lo trackea en memoria)
            existing_product.stock_quantity += data['qty']
            existing_product.price = data['cost']

            # Agregar a respuesta
            if status != "hidden":
                processed_response.append({
                    "id": existing_product.id,
                    "name": existing_product.name,
                    "qty": data['qty'],
                    "cost": data['cost'],
                    "cost_with_tax": data['cost_tax'],
                    "old_cost": old_cost,
                    "selling_price": existing_product.selling_price or 0.0,
                    "sku": existing_product.sku,
                    "status": status,
                    "suggestions": []
                })

        else:
            # --- PRODUCTO NUEVO ---
            status = "new"
            
            # OPTIMIZACIÓN: Desactivar difflib para cargas masivas (>100 items)
            # Si activas esto con 15,000 items, el servidor explotará por CPU.
            # matches = difflib.get_close_matches(data['name'], list(db_product_map.keys()), n=3, cutoff=0.6)
            # ... lógica de sugerencias ...
            
            unique_sku = generate_unique_sku(data['name'], data['sku'])
            
            # Crear instancia (sin ID todavía)
            new_p = Product(
                sku=unique_sku, 
                name=data['name'], 
                price=data['cost'], 
                stock_quantity=data['qty'], 
                selling_price=0.0
            )
            
            new_products_list.append(new_p)
            new_products_cost_map[data['name']] = data['cost'] # Guardamos costo para el historial luego

            # Agregar a respuesta (ID será null o temporal en el front, no importa)
            processed_response.append({
                "id": 0, # Se actualizará o el front lo maneja como nuevo
                "name": data['name'],
                "qty": data['qty'],
                "cost": data['cost'],
                "cost_with_tax": data['cost_tax'],
                "old_cost": 0.0,
                "selling_price": 0.0,
                "sku": "NUEVO",
                "status": "new",
                "suggestions": []
            })

    # 4. GUARDADO MASIVO (La magia de la velocidad)
    
    # A) Insertar nuevos productos
    if new_products_list:
        db.add_all(new_products_list)
        await db.flush() # ESTO ES CLAVE: Asigna IDs a los nuevos productos en 1 solo viaje

        # B) Crear historial para los nuevos (ahora que tienen ID)
        for p in new_products_list:
            cost = new_products_cost_map.get(p.name, 0.0)
            history_entries.append(PriceHistory(
                product_id=p.id, 
                change_type="COSTO", 
                old_value=0, 
                new_value=cost
            ))

    # C) Insertar todo el historial acumulado
    if history_entries:
        db.add_all(history_entries)

    # D) Confirmar todo
    await db.commit()
    
    # Ordenar respuesta
    def sort_priority(item):
        if item['status'] == 'price_changed': return 0
        if item['status'] == 'new': return 1
        return 2

    processed_response.sort(key=sort_priority)
    
    hidden_count = len(grouped_items) - len(processed_response)
    
    return {
        "message": "Procesado correctamente", 
        "products": processed_response, 
        "hidden_count": hidden_count
    }

# --- 2. ACTUALIZAR PRECIOS DE VENTA ---
@router.post("/update-prices")
async def update_prices(updates: List[Dict] = Body(...), db: AsyncSession = Depends(get_db)):
    count = 0
    # Optimización simple: procesar en memoria si es posible, pero update es rápido usualmente
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
    # Optimización: Solo traer columnas necesarias si la tabla es gigante
    result = await db.execute(select(Product).order_by(Product.name))
    return [{"id": p.id, "sku": p.sku, "upc": p.upc or "", "name": p.name, "selling_price": p.selling_price, "stock": p.stock_quantity} for p in result.scalars().all()]

# --- 4. ACTUALIZAR CÓDIGOS ---
@router.put("/products/{product_id}")
async def update_product_codes(product_id: int, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product: raise HTTPException(404)
    if "sku" in data: product.sku = data["sku"]
    if "upc" in data: product.upc = data["upc"]
    try: await db.commit()
    except: raise HTTPException(400, "ID duplicado")
    return {"msg": "Ok"}

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

# --- 6. OBTENER HISTORIAL ---
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

# --- 7. CREAR PRODUCTO MANUAL ---
@router.post("/products/manual")
async def create_manual_product(item: ManualProductSchema, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.name == item.name)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya existe un producto con este nombre.")

    final_sku = item.sku
    if not final_sku:
        final_sku = generate_unique_sku(item.name, "MANUAL")
    
    stmt_sku = select(Product).where(Product.sku == final_sku)
    if (await db.execute(stmt_sku)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"El SKU '{final_sku}' ya existe.")

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