"""Run from backend: venv/Scripts/python.exe -m unittest discover -s tests -v.

Exercise real HTTP routing and security dependencies without database access.
Business handlers are replaced by probes; startup migrations are not run.
"""
import os
import unittest
from datetime import timedelta

os.environ.update(
    DATABASE_URL="postgresql+asyncpg://test:test@127.0.0.1:1/test",
    PROJECT_NAME="security-test",
    SECRET_KEY="isolated-test-key",
    ALGORITHM="HS256",
    ACCESS_TOKEN_EXPIRE_MINUTES="15",
)

from fastapi.routing import APIRoute
from app.main import app, create_access_token, get_db as main_db
from app.core.database import get_db
from app.core.security import get_current_user, verify_admin


async def fake_db():
    yield object()


async def probe(**kwargs):
    return {"reached_endpoint": True}


def has_dependency(dependency, target):
    return dependency.call is target or any(
        has_dependency(child, target) for child in dependency.dependencies
    )


async def request(method, path, token=None, upload=False):
    content_type = "application/json"
    body = b"{}"
    if upload:
        content_type = "multipart/form-data; boundary=TEST"
        body = (b'--TEST\r\nContent-Disposition: form-data; name="file"; '
                b'filename="test.xml"\r\nContent-Type: application/xml\r\n'
                b'\r\n<test/>\r\n--TEST--\r\n')
    headers = [(b"content-type", content_type.encode())]
    if token:
        headers.append((b"authorization", ("Bearer " + token).encode()))
    scope = dict(type="http", asgi={"version": "3.0"}, http_version="1.1",
                 method=method, scheme="http", path=path, raw_path=path.encode(),
                 query_string=b"", root_path="", headers=headers,
                 client=("127.0.0.1", 1234), server=("test", 80))
    messages = []

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    await app(scope, receive, send)
    return next(m["status"] for m in messages if m["type"] == "http.response.start")


class SecurityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        prefixes = ("/invoices", "/suppliers", "/shopping-lists", "/locations",
                    "/categories", "/inventory/reports")
        self.routes = [r for r in app.routes if isinstance(r, APIRoute)
                       and r.path.startswith(prefixes)]
        self.originals = [(r, r.dependant.call) for r in self.routes]
        self.overrides = app.dependency_overrides.copy()
        app.dependency_overrides.update({get_db: fake_db, main_db: fake_db})
        for route in self.routes:
            route.dependant.call = probe
        self.admin = create_access_token({"sub": "admin-test", "role": "admin"})
        self.uploader = create_access_token(
            {"sub": "uploader-test", "role": "user", "permissions": ["upload"]})

    def tearDown(self):
        for route, original in self.originals:
            route.dependant.call = original
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.overrides)

    def test_all_business_routes_require_authentication(self):
        self.assertEqual(len(self.routes), 51)
        for route in self.routes:
            with self.subTest(path=route.path):
                self.assertTrue(has_dependency(route.dependant, get_current_user))

    async def test_reads(self):
        expired = create_access_token({"sub": "expired", "role": "admin"},
                                      timedelta(seconds=-30))
        paths = ("/invoices/products", "/suppliers", "/shopping-lists",
                 "/locations", "/categories", "/inventory/reports/summary")
        for path in paths:
            for token, expected in [(None, 401), ("invalid", 401), (expired, 401),
                                    (self.uploader, 200), (self.admin, 200)]:
                with self.subTest(path=path, expected=expected):
                    self.assertEqual(await request("GET", path, token), expected)

    async def test_upload_permissions(self):
        for path in ("/invoices/upload", "/invoices/upload-catalog"):
            cases = [(None, 401), (self.admin, 200), (self.uploader, 200)]
            for permissions in (None, [], ["search"], "upload", {"upload": True}):
                token = create_access_token({"sub": "denied", "role": "user",
                                             "permissions": permissions})
                cases.append((token, 403))
            for token, expected in cases:
                with self.subTest(path=path, expected=expected):
                    self.assertEqual(await request("POST", path, token, True), expected)

    async def test_deletions_and_merge_remain_admin_only(self):
        routes = [r for r in self.routes if has_dependency(r.dependant, verify_admin)]
        self.assertEqual(len(routes), 7)
        for route in routes:
            path = route.path
            for param in route.param_convertors:
                path = path.replace("{" + param + "}", "999999")
            for token, expected in [(None, 401), (self.uploader, 403), (self.admin, 200)]:
                with self.subTest(path=path, expected=expected):
                    self.assertEqual(await request(next(iter(route.methods)), path, token), expected)
