from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional, List
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker # <--- IMPORTANTE
from sqlalchemy.orm import DeclarativeBase

# --- TUS IMPORTACIONES EXISTENTES ---
from app.api.endpoints import invoices
from app.core.database import engine, Base

# --- 1. CONFIGURACIÓN DE SEGURIDAD ---
SECRET_KEY = "1234hola"  # Tu clave secreta
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# --- 2. MODELO DE BASE DE DATOS (TABLA REAL) ---
class UserDB(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)
    created_at = Column(String)

# --- 3. MODELOS PYDANTIC ---
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
    
    class Config:
        from_attributes = True

# --- 4. FUNCIONES DE AYUDA ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- 5. GESTIÓN DE BASE DE DATOS ASÍNCRONA ---
# Creamos el generador de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- 6. INICIALIZACIÓN ---
async def startup_event():
    # Crear tablas (async compatible)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Base de datos inicializada correctamente.")

app = FastAPI(on_startup=[startup_event])

# --- 7. CORS ---
origins = [
    "http://localhost:5173",
    "https://radar-price-production.up.railway.app",
    "https://frontend-production-a0cf.up.railway.app" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 8. ENDPOINTS (CONECTADOS A POSTGRES CON AWAIT) ---

@app.post("/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # 1. Buscar usuario con AWAIT
    stmt = select(UserDB).where(UserDB.username == form_data.username)
    result = await db.execute(stmt) # <--- AWAIT AQUÍ
    user = result.scalar_one_or_none()

    # --- AUTO-CREACIÓN DE ADMIN (CORREGIDO PARA ASYNC) ---
    if not user and form_data.username == "admin":
        stmt_count = select(UserDB)
        result_count = await db.execute(stmt_count) # <--- AWAIT AQUÍ
        users_count = result_count.scalars().all()
        
        if len(users_count) == 0:
            print("Base de datos vacía. Creando ADMIN por defecto...")
            admin_user = UserDB(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                created_at=datetime.now().isoformat()
            )
            db.add(admin_user)
            await db.commit() # <--- AWAIT AQUÍ
            await db.refresh(admin_user) # <--- AWAIT AQUÍ
            user = admin_user
    # ---------------------------------------------------------

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Dependencia para obtener usuario actual
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        return {"username": username, "role": role}
    except JWTError:
        raise credentials_exception

async def verify_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Requiere permisos de Administrador")
    return current_user

# --- RUTAS DE GESTIÓN DE USUARIOS (ASYNC) ---

@app.get("/users", response_model=List[UserResponse])
async def get_users(db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)):
    stmt = select(UserDB)
    result = await db.execute(stmt) # <--- AWAIT
    users = result.scalars().all()
    return users

@app.post("/auth/register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)):
    # Verificar si existe
    stmt = select(UserDB).where(UserDB.username == user.username)
    result = await db.execute(stmt) # <--- AWAIT
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    new_user = UserDB(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=user.role,
        created_at=datetime.now().isoformat()
    )
    db.add(new_user)
    await db.commit() # <--- AWAIT
    return {"message": "Usuario creado exitosamente"}

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)):
    stmt = select(UserDB).where(UserDB.id == user_id)
    result = await db.execute(stmt) # <--- AWAIT
    user_to_delete = result.scalar_one_or_none()
    
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    if user_to_delete.username == "admin":
         raise HTTPException(status_code=400, detail="No puedes eliminar al admin principal")
         
    await db.delete(user_to_delete) # <--- AWAIT
    await db.commit() # <--- AWAIT
    return {"message": "Usuario eliminado"}

# --- OTRAS RUTAS ---
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])

@app.get("/")
def read_root():
    return {"message": "Sistema Online con Base de Datos Async 🚀"}