"""Image round trips through real handlers and fresh SQLite sessions."""
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.update(
    DATABASE_URL="postgresql+asyncpg://test:test@127.0.0.1:1/test",
    PROJECT_NAME="image-test",
    SECRET_KEY="isolated-test-key",
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="15",
)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.api.endpoints.invoices import get_products, update_product_single
from app.domain.models import Base, Product


class AsyncSessionAdapter:
    """Use SQLite's built-in driver with the async endpoint interface."""
    def __init__(self, session):
        self.session = session

    async def get(self, model, key):
        return self.session.get(model, key)

    async def execute(self, statement):
        return self.session.execute(statement)

    async def commit(self):
        self.session.commit()

    async def refresh(self, obj):
        self.session.refresh(obj)

    async def rollback(self):
        self.session.rollback()


class ProductImageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.directory.name) / 'images.db'}")
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as session:
            session.add(Product(id=1, sku="IMAGE-TEST", name="Test image product"))
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        self.directory.cleanup()

    async def test_photo_survives_reload_replacement_and_removal(self):
        for image in ("data:image/webp;base64,Zmlyc3Q=",
                      "data:image/webp;base64,c2Vjb25k", None):
            with self.subTest(image=image):
                with Session(self.engine) as session:
                    await update_product_single(1, {"image_url": image}, AsyncSessionAdapter(session))
                # A new session prevents the ORM cache from hiding a missing commit.
                with Session(self.engine) as session:
                    self.assertEqual(session.get(Product, 1).image_url, image)
                    result = await get_products(db=AsyncSessionAdapter(session))
                    self.assertEqual(result["items"][0]["image_url"], image or "")

    async def test_product_without_photo_returns_empty_image(self):
        with Session(self.engine) as session:
            result = await get_products(db=AsyncSessionAdapter(session))
            self.assertEqual(result["items"][0]["image_url"], "")
