from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


# --- PROVEEDOR ---
class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    rfc = Column(String, unique=True, nullable=True, index=True)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="supplier")
    shopping_lists = relationship("ShoppingList", back_populates="supplier")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    upc = Column(String, nullable=True, index=True)
    name = Column(String)
    alias = Column(String, nullable=True)
    description = Column(String, nullable=True)

    price = Column(Float, default=0.0)  # Costo actual
    selling_price = Column(Float, default=0.0)  # Precio Venta actual
    stock_quantity = Column(Integer, default=0)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="products")

    # Relación con el historial
    history = relationship(
        "PriceHistory", back_populates="product", cascade="all, delete-orphan"
    )


# --- NUEVA TABLA: HISTORIAL ---
class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))

    change_type = Column(String)  # "COSTO" (XML) o "PRECIO" (Manual)

    old_value = Column(Float)  # Cuánto costaba antes
    new_value = Column(Float)  # Cuánto cuesta ahora

    date = Column(DateTime, default=datetime.utcnow)  # Fecha del cambio

    product = relationship("Product", back_populates="history")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)  # Nombre del archivo XML o "Carga Masiva Manual test"

    # Relación para borrar en cascada si borras el historial
    items = relationship(
        "ImportBatchItem", back_populates="batch", cascade="all, delete-orphan"
    )


class ImportBatchItem(Base):
    __tablename__ = "import_batch_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float, default=0)
    batch = relationship("ImportBatch", back_populates="items")
    product = relationship("Product")  # Para poder acceder a los datos del producto


# --- LISTA DE COMPRAS ---
class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    status = Column(String, default="active")  # active, completed, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(String, nullable=True)

    supplier = relationship("Supplier", back_populates="shopping_lists")
    items = relationship(
        "ShoppingListItem", back_populates="shopping_list", cascade="all, delete-orphan"
    )


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("shopping_lists.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    added_at = Column(DateTime, default=datetime.utcnow)

    shopping_list = relationship("ShoppingList", back_populates="items")
    product = relationship("Product")


# --- UBICACIONES / INVENTARIO ---
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)  # Ej: R1B2, R1B3
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product_locations = relationship(
        "ProductLocation", back_populates="location", cascade="all, delete-orphan"
    )


class ProductLocation(Base):
    __tablename__ = "product_locations"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=0)
    added_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location", back_populates="product_locations")
    product = relationship("Product")
