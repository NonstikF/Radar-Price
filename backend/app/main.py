from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional, List

# --- TUS IMPORTACIONES EXISTENTES ---
from app.api.endpoints import invoices
from app.core.database import engine, Base

# --- 1. CONFIGURACIÓN DE SEGURIDAD ---
SECRET_KEY = "supersecreto_dificil_de_adivinar_12345"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# --- 2. MODELOS DE DATOS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: str

# --- 3. BASE DE DATOS SIMULADA (MOCK DB) ---
# Usamos una lista para que sea más fácil manejar IDs numéricos como espera el frontend
fake_users_db = [
    {
        "id": 1,
        "username": "admin",
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga311W", # admin123
        "role": "admin",
        "created_at": datetime.now().isoformat()
    }
]

# --- 4. FUNCIONES DE AYUDA ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- 5. INICIALIZACIÓN ---
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(on_startup=[startup_event])

# --- 6. CORS ---
origins = [
    "http://localhost:5173",
    "https://radar-price-production.up.railway.app", 
    "https://frontend-production-a0cf.up.railway.app",
    "*" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 7. ENDPOINTS DE AUTENTICACIÓN Y USUARIOS ---

# LOGIN
@app.post("/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Buscar usuario en la lista
    user = next((u for u in fake_users_db if u["username"] == form_data.username), None)
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# LISTAR USUARIOS (Para el panel Admin)
@app.get("/users", response_model=List[UserResponse])
async def get_users():
    return fake_users_db

# CREAR USUARIO (Registro)
@app.post("/auth/register")
async def register_user(user: UserCreate):
    # Verificar si existe
    if any(u["username"] == user.username for u in fake_users_db):
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    new_user = {
        "id": len(fake_users_db) + 1 + int(datetime.now().timestamp()), # ID único simple
        "username": user.username,
        "hashed_password": get_password_hash(user.password),
        "role": user.role,
        "created_at": datetime.now().isoformat()
    }
    fake_users_db.append(new_user)
    return {"message": "Usuario creado exitosamente"}

# ELIMINAR USUARIO
@app.delete("/users/{user_id}")
async def delete_user(user_id: int):
    global fake_users_db
    # No permitir borrar al admin principal (ID 1)
    if user_id == 1:
        raise HTTPException(status_code=400, detail="No puedes eliminar al administrador principal")
    
    fake_users_db = [u for u in fake_users_db if u["id"] != user_id]
    return {"message": "Usuario eliminado"}

# --- 8. OTRAS RUTAS ---
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])

@app.get("/")
def read_root():
    return {"message": "Sistema de Paquetes Funcionando 🚀"}