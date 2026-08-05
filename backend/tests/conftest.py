import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def db_sessionmaker(tmp_path):
    """Session factory bound to the same per-test sqlite DB the `client`
    fixture uses. Lets tests reach into the DB directly (e.g. to backdate
    timestamps for grace-period tests) without a second, disconnected DB."""
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal


@pytest.fixture()
def client(db_sessionmaker, monkeypatch):
    def override_get_db():
        db = db_sessionmaker()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    import app.archive as archive_module

    monkeypatch.setattr(archive_module, "SessionLocal", db_sessionmaker)

    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register_user(client: TestClient, phone: str) -> dict:
    from app import sms

    client.post("/auth/phone", json={"phone": phone})
    code = sms._codes[phone][0]
    resp = client.post("/auth/verify", json={"phone": phone, "code": code})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
