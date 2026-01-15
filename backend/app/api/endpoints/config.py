from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db
from app.services.config_service import ConfigService

router = APIRouter()

class ApiKeyInput(BaseModel):
    api_key: str

@router.post("/api-key")
async def save_api_key(
    input_data: ApiKeyInput, 
    db: AsyncSession = Depends(get_db)
):
    """
    Guarda la API Key de Gemini en la base de datos.
    """
    if not input_data.api_key.strip():
        raise HTTPException(status_code=400, detail="La API Key no puede estar vacía")
    
    await ConfigService.set_gemini_key(db, input_data.api_key)
    return {"message": "API Key guardada correctamente"}