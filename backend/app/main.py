import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# --- IMPORTS ---
# Asegúrate de que estos archivos existen y son correctos
from app.api.endpoints import invoices
from app.core.database import engine, Base

# --- 1. SECURITY CONFIGURATION ---
SECRET_KEY = "1234hola"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


# --- 2. DATABASE MODELS ---
# Definimos el modelo aquí para asegurar que 'role' no tenga defaults extraños
class UserDB(Base):
    __tablename__ = "users"
    __table_args__ = {
        "extend_existing": True
    }  # Permite redefinir si ya existe en memoria

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # Sin default, obligamos a pasar valor
    permissions = Column(String, default="[]")
    created_at = Column(String)


# --- 3. PYDANTIC MODELS ---
class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    permissions: List[str]
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


# --- 4. HELPER FUNCTIONS ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --- 5. DATABASE MANAGEMENT ---
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# --- 6. INITIALIZATION ---
async def startup_event():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
        except Exception:
            pass
        await conn.run_sync(Base.metadata.create_all)


app = FastAPI(on_startup=[startup_event])

# --- 7. CORS ---
origins = ["*"]  # Abierto para desarrollo

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 8. LOGIN ENDPOINT ---
@app.post("/auth/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    # 1. Find user
    stmt = select(UserDB).where(UserDB.username == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Auto-create Admin if not exists (Only if users table is empty)
    if not user and form_data.username == "admin":
        stmt_count = select(UserDB)
        result_count = await db.execute(stmt_count)
        if len(result_count.scalars().all()) == 0:
            print("--- AUTO-CREANDO ADMIN ---")
            admin_user = UserDB(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                permissions=json.dumps(
                    ["dashboard", "upload", "search", "manual", "users"]
                ),
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)
            user = admin_user

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # 2. Decode permissions
    try:
        perms = json.loads(user.permissions)
    except:
        perms = []

    # 3. Create Token
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "permissions": perms},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "permissions": perms,
        "username": user.username,
        "role": user.role,
    }


# --- 9. USER MANAGEMENT ENDPOINTS ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


async def verify_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    return current_user


@app.get("/users", response_model=List[UserResponse])
async def get_users(
    db: AsyncSession = Depends(get_db), current_user: dict = Depends(verify_admin)
):
    stmt = select(UserDB)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            role=u.role,
            permissions=json.loads(u.permissions) if u.permissions else [],
            created_at=u.created_at or "",
        )
        for u in users
    ]


@app.post("/auth/register")
async def register_user(
    user: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    # --- DEBUGGING DURO ---
    print(f"\n--- DEBUG REGISTRO ---")
    print(f"Recibido Username: {user.username}")
    print(f"Recibido Rol: '{user.role}'")  # Comillas para ver espacios vacíos
    print(f"Recibido Permisos: {user.permissions}")
    # ----------------------

    stmt = select(UserDB).where(UserDB.username == user.username)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Usuario ya existe")

    # Lógica de permisos
    perms_str = json.dumps(user.permissions)

    # IMPORTANTE: Forzamos minúsculas y quitamos espacios por seguridad
    clean_role = user.role.lower().strip()

    if clean_role == "admin":
        perms_str = json.dumps(["dashboard", "upload", "search", "manual", "users"])

    new_user = UserDB(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=clean_role,  # Usamos el rol limpio
        permissions=perms_str,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    db.add(new_user)
    await db.commit()

    print(f"Guardado en BD con Rol: '{new_user.role}'\n")  # Confirmación de guardado

    return {"message": "Usuario creado"}


@app.put("/users/{user_id}")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    # 1. Buscar usuario
    stmt = select(UserDB).where(UserDB.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # 2. Actualizar campos si vienen en la petición
    if user_data.username:
        # Verificar que el nombre no esté tomado por otro
        stmt_check = select(UserDB).where(UserDB.username == user_data.username)
        res_check = await db.execute(stmt_check)
        existing = res_check.scalar_one_or_none()
        if existing and existing.id != user_id:
            raise HTTPException(
                status_code=400, detail="El nombre de usuario ya está en uso"
            )
        user.username = user_data.username

    if user_data.password and user_data.password.strip():
        user.hashed_password = get_password_hash(user_data.password)

    if user_data.role:
        user.role = user_data.role.lower().strip()
        # Si cambia a admin, reseteamos permisos visuales o los llenamos todos
        if user.role == "admin":
            user.permissions = json.dumps(
                ["dashboard", "upload", "search", "manual", "users"]
            )

    if user_data.permissions is not None and user.role != "admin":
        user.permissions = json.dumps(user_data.permissions)

    await db.commit()
    await db.refresh(user)
    return {"message": "Usuario actualizado correctamente"}


@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(verify_admin),
):
    stmt = select(UserDB).where(UserDB.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)
    if user.username == "admin":
        raise HTTPException(
            status_code=400, detail="No puedes borrar al admin principal"
        )
    await db.delete(user)
    await db.commit()
    return {"message": "Eliminado"}


app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
