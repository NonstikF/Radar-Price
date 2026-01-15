from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.domain.models import SystemConfig

class ConfigService:
    @staticmethod
    async def get_gemini_key(db: AsyncSession) -> str | None:
        """Busca la API Key en la base de datos"""
        query = select(SystemConfig).where(SystemConfig.key == "gemini_api_key")
        result = await db.execute(query)
        config = result.scalar_one_or_none()
        return config.value if config else None

    @staticmethod
    async def set_gemini_key(db: AsyncSession, new_key: str):
        """Guarda o actualiza la API Key en la base de datos"""
        # 1. Buscamos si ya existe
        query = select(SystemConfig).where(SystemConfig.key == "gemini_api_key")
        result = await db.execute(query)
        config = result.scalar_one_or_none()

        if config:
            # Si existe, actualizamos
            config.value = new_key
        else:
            # Si no, creamos uno nuevo
            new_config = SystemConfig(key="gemini_api_key", value=new_key)
            db.add(new_config)
        
        # Guardamos cambios
        await db.commit()
        await db.refresh(config if config else new_config)