from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional, List
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import json

# --- TUS IMPORTACIONES EXISTENTES ---
from app.api.endpoints import invoices
from app.core.database import engine, Base

# --- 1. CONFIGURACIÓN DE SEGURIDAD ---
SECRET_KEY = "1234hola"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# --- 2. MODELO DE BASE DE DATOS ---
class UserDB(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)
    permissions = Column(String, default="[]") 
    created_at = Column(String)

# --- 3. MODELOS PYDANTIC ---
class Token(BaseModel):
    access_token: str
    token_type: str
    permissions: List[str]
    # ✅ NUEVOS CAMPOS AGREGADOS:
    username: str
    role: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    permissions: List[str] = []

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    permissions: List[str]
    created_at: str
    
    class Config:
        from_attributes = True
        
    @staticmethod
    def resolve_permissions(obj):
        try:
            return json.loads(obj.permissions)
        except:
            return []

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
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# --- 6. INICIALIZACIÓN ---
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = FastAPI(on_startup=[startup_event])

# --- 7. CORS ---
origins = ["*"] 

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 8. AUTH ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        permissions: List[str] = payload.get("permissions", [])
        if username is None:
            raise HTTPException(status_code=401)
        return {"username": username, "role": role, "permissions": permissions}
    except JWTError:
        raise HTTPException(status_code=401)

async def verify_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Requiere permisos de Administrador")
    return current_user

# --- 9. ENDPOINTS ---

@app.post("/auth/token", response_model=Token) # ✅ Usa el modelo actualizado
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    stmt = select(UserDB).where(UserDB.username == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Auto-crear Admin
    if not user and form_data.username == "admin":
        stmt_count = select(UserDB)
        result_count = await db.execute(stmt_count)
        if len(result_count.scalars().all()) == 0:
            admin_user = UserDB(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                permissions=json.dumps(["dashboard", "upload", "search", "manual", "users"]),
                created_at=datetime.now().isoformat()
            )
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            user = admin_user

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    try:
        perms = json.loads(user.permissions)
    except:
        perms = []

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "permissions": perms},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    # ✅ RETORNO CORREGIDO CON USERNAME Y ROLE
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "permissions": perms,
        "username": user.username,
        "role": user.role
    }

@app.get("/users", response_model=List[UserResponse])
async def get_users(db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)):
    stmt = select(UserDB)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id, 
            username=u.username, 
            role=u.role, 
            permissions=json.loads(u.permissions) if u.permissions else [], 
            created_at=u.created_at
        ) for u in users
    ]

@app.post("/auth/register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)):
    stmt = select(UserDB).where(UserDB.username == user.username)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    final_permissions = user.permissions
    if user.role == 'admin':
        final_permissions = ["dashboard", "upload", "search", "manual", "users"]

    new_user = UserDB(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=user.role,
        permissions=json.dumps(final_permissions),
        created_at=datetime.now().isoformat()
    )
    db.add(new_user)
    await db.commit()
    return {"message": "Usuario creado"}

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)):
    stmt = select(UserDB).where(UserDB.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user: raise HTTPException(status_code=404)
    if user.username == "admin": raise HTTPException(status_code=400)
    await db.delete(user)
    await db.commit()
    return {"message": "Eliminado"}

app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])