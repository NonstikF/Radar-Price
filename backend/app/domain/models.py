from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    upc = Column(String, nullable=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    
    price = Column(Float, default=0.0)         # Costo actual
    selling_price = Column(Float, default=0.0) # Precio Venta actual
    stock_quantity = Column(Integer, default=0)

    # Relación con el historial
    history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")

# --- NUEVA TABLA: HISTORIAL ---
class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    
    change_type = Column(String) # "COSTO" (XML) o "PRECIO" (Manual)
    
    old_value = Column(Float) # Cuánto costaba antes
    new_value = Column(Float) # Cuánto cuesta ahora
    
    date = Column(DateTime, default=datetime.utcnow) # Fecha del cambio

    product = relationship("Product", back_populates="history")