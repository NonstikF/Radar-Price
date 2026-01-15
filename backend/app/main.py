from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import invoices
from app.core.database import engine, Base

# Crear tablas al iniciar (por seguridad, aunque ya usamos docker)
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(on_startup=[startup_event])

# --- CONFIGURACIÓN DE SEGURIDAD (CORS) ---
# El asterisco "*" significa: "Acepta peticiones de CUALQUIER lugar"
# Esto es vital para que funcione desde el celular.
origins = [
    "http://localhost:5173",
    # Agrega TU URL de frontend de Railway (sin barra al final)
    "https://radar-price-production.up.railway.app", 
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