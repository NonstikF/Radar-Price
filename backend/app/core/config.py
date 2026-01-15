from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    class Config:
        env_file = ".env"

# Instanciamos la configuración para usarla en toda la app
settings = Settings()