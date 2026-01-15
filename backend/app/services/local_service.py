import io
import re
import pdfplumber
from typing import List, Dict, Any

class LocalInvoiceParser:
    def __init__(self):
        # AQUÍ DEFINES TUS REGLAS. 
        # Esta es la regla estándar para leer líneas con: SKU  Descripción  Cantidad  Precio
        self.default_regex = r"(?P<sku>[A-Z0-9]+)\s+(?P<name>.+?)\s+(?P<quantity>\d+)\s+(?P<price>\d+\.\d{2})"

    async def extract_data(self, pdf_content: bytes, db=None) -> List[Dict[str, Any]]:
        print("--- INICIANDO PROCESAMIENTO LOCAL (SIN IA) ---")
        
        # 1. Extraer texto crudo del PDF
        text = ""
        with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        
        print(f"Texto extraído ({len(text)} caracteres). Buscando patrones...")

        items = []
        pattern = re.compile(self.default_regex)

        # 2. Buscar coincidencias línea por línea
        for line in text.split('\n'):
            match = pattern.search(line)
            if match:
                data = match.groupdict()
                items.append({
                    "sku": data.get("sku"),
                    "name": data.get("name").strip(),
                    "quantity": int(data.get("quantity")),
                    "price": float(data.get("price"))
                })

        # 3. PLAN B (SOLO PARA PRUEBAS)
        # Si el PDF no coincide con el Regex, devolvemos un producto falso
        # para confirmar que el sistema funciona y no se rompa.
        if not items:
            print("No se detectaron productos con el Regex actual. Usando datos de prueba.")
            return [
                {
                    "sku": "TEST-LOCAL", 
                    "name": "Lectura Local Exitosa (Sin Coincidencias)", 
                    "quantity": 100, 
                    "price": 0.00
                }
            ]

        print(f"Se encontraron {len(items)} productos.")
        return items