from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# --- FIX PARA RAILWAY ---
# Railway entrega la URL como "postgres://...", pero SQLAlchemy asíncrono
# necesita "postgresql+asyncpg://...". Aquí hacemos el cambio automático.
connection_string = settings.DATABASE_URL

if connection_string and connection_string.startswith("postgres://"):
    connection_string = connection_string.replace("postgres://", "postgresql+asyncpg://", 1)

# 1. Crear el motor asíncrono usando la URL corregida
# 'pool_pre_ping=True' ayuda a recuperar conexiones perdidas (muy útil en la nube)
engine = create_async_engine(
    connection_string, 
    echo=True, 
    pool_pre_ping=True
)

# 2. Crear la fábrica de sesiones
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession
)

# 3. Base para los modelos
Base = declarative_base()

# 4. Dependencia para obtener la DB
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()