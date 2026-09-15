"""Dependencias de autenticación/autorización compartidas.

Se extraen aquí (y no en main.py) para que los routers en app/api/endpoints
puedan importarlas sin generar un ciclo de imports (main.py importa los routers).

IMPORTANTE: SECRET_KEY/ALGORITHM se leen con os.environ exactamente igual que
en main.py para que el token emitido por /auth/token y el validado aquí usen la
misma clave. Unificar la fuente de config (C-4) es un cambio aparte.
"""

import os

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
ALGORITHM = os.environ.get("ALGORITHM", "HS256")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


async def verify_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    return current_user


async def verify_upload_permission(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") == "admin":
        return current_user
    permissions = current_user.get("permissions")
    if not isinstance(permissions, list) or "upload" not in permissions:
        raise HTTPException(status_code=403, detail="No tienes permiso para cargar XML/Facturas")
    return current_user
