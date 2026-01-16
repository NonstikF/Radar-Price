from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import invoices
from app.core.database import engine, Base

# Crear tablas al iniciar (por seguridad, aunque ya usamos docker)
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(on_startup=[startup_event])


origins = [
    "http://localhost:5173",
    "https://radar-price-production.up.railway.app", 
    "https://frontend-production-a0cf.up.railway.app",
    "*" # Déjalo por ahora para descartar problemas
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar las rutas
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])

@app.get("/")
def read_root():
    return {"message": "Sistema de Paquetes Funcionando 🚀"}