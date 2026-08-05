from tests.conftest import register_user


def test_empty_phone_accepted_without_validation(client):
    """No server-side phone format validation exists (schemas.PhoneRequest.phone: str).
    Documents current behavior: an empty string is accepted and a code is generated for it.
    """
    resp = client.post("/auth/phone", json={"phone": ""})
    assert resp.status_code == 204


def test_garbage_phone_accepted_without_validation(client):
    resp = client.post("/auth/phone", json={"phone": "not-a-phone-at-all!!"})
    assert resp.status_code == 204


def test_verify_unknown_phone_rejected(client):
    resp = client.post("/auth/verify", json={"phone": "+79990009999", "code": "0000"})
    assert resp.status_code == 400


def test_code_cannot_be_reused(client):
    from app import sms

    phone = "+79990000101"
    client.post("/auth/phone", json={"phone": phone})
    code = sms._codes[phone][0]

    first = client.post("/auth/verify", json={"phone": phone, "code": code})
    assert first.status_code == 200

    second = client.post("/auth/verify", json={"phone": phone, "code": code})
    assert second.status_code == 400


def test_expired_code_rejected(client, monkeypatch):
    from datetime import datetime, timedelta

    from app import sms

    phone = "+79990000102"
    client.post("/auth/phone", json={"phone": phone})
    code, _ = sms._codes[phone]
    # simulate TTL passing
    sms._codes[phone] = (code, datetime.utcnow() - timedelta(seconds=1))

    resp = client.post("/auth/verify", json={"phone": phone, "code": code})
    assert resp.status_code == 400


def test_invalid_token_rejected(client):
    resp = client.get("/users/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_malformed_auth_header_rejected(client):
    resp = client.get("/users/me", headers={"Authorization": "not-bearer-format"})
    assert resp.status_code in (401, 403)


def test_missing_code_field_returns_422(client):
    resp = client.post("/auth/verify", json={"phone": "+79990000103"})
    assert resp.status_code == 422


def test_second_login_for_same_phone_returns_same_user(client):
    """Verifying twice for the same phone (two separate code requests) must not create
    a duplicate user row — should return a token for the same user id both times."""
    from app import sms

    phone = "+79990000104"
    client.post("/auth/phone", json={"phone": phone})
    code1 = sms._codes[phone][0]
    resp1 = client.post("/auth/verify", json={"phone": phone, "code": code1})
    token1_headers = {"Authorization": f"Bearer {resp1.json()['access_token']}"}
    user1 = client.get("/users/me", headers=token1_headers).json()

    client.post("/auth/phone", json={"phone": phone})
    code2 = sms._codes[phone][0]
    resp2 = client.post("/auth/verify", json={"phone": phone, "code": code2})
    token2_headers = {"Authorization": f"Bearer {resp2.json()['access_token']}"}
    user2 = client.get("/users/me", headers=token2_headers).json()

    assert user1["id"] == user2["id"]
