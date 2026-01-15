from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# --- FIX PARA RAILWAY (ROBUSTO) ---
connection_string = settings.DATABASE_URL

if connection_string:
    # Si empieza con "postgres://", lo cambiamos (caso antiguo)
    if connection_string.startswith("postgres://"):
        connection_string = connection_string.replace("postgres://", "postgresql+asyncpg://", 1)
    # Si empieza con "postgresql://" (caso nuevo), TAMBIÉN lo cambiamos
    elif connection_string.startswith("postgresql://"):
        connection_string = connection_string.replace("postgresql://", "postgresql+asyncpg://", 1)

# 1. Crear el motor asíncrono
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