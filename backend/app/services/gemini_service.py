import json
import google.generativeai as genai
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.config_service import ConfigService

class GeminiInvoiceParser:
    def __init__(self):
        self.model_name = "gemini-pro"

    async def extract_data(self, pdf_content: bytes, db: AsyncSession) -> List[Dict[str, Any]]:
        # 1. Buscamos la llave en la base de datos
        api_key = await ConfigService.get_gemini_key(db)
        
        # 2. Si no hay llave, lanzamos el error para que el Frontend abra el modal
        if not api_key:
            raise ValueError("API_KEY_MISSING")

        try:
            # 3. Configuramos Gemini
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(self.model_name)

            prompt = """
            Actúa como un extractor de datos de facturas. Analiza este archivo PDF.
            Extrae una lista de los artículos. Devuelve SOLO un JSON válido.
            Formato: [{"sku": "...", "name": "...", "quantity": 0, "price": 0.0}]
            """

            # 4. Enviamos el PDF a Google
            response = model.generate_content([
                prompt,
                {"mime_type": "application/pdf", "data": pdf_content}
            ])

            # 5. Limpiamos la respuesta
            text_response = response.text.replace("```json", "").replace("```", "").strip()
            data = json.loads(text_response)
            return data

        except Exception as e:
            # Si la llave es inválida (ej: copiada mal), avisamos
            if "403" in str(e) or "API key" in str(e):
                raise ValueError("API_KEY_INVALID")
            print(f"Error procesando con Gemini: {e}")
            raise e