from tests.conftest import register_user


def test_phone_verify_flow(client):
    headers = register_user(client, "+79990000001")
    resp = client.get("/users/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["meetings_count"] == 0


def test_wrong_code_rejected(client):
    from app import sms

    phone = "+79990000002"
    client.post("/auth/phone", json={"phone": phone})
    real_code = sms._codes[phone][0]
    wrong_code = f"{(int(real_code) + 1) % 10000:04d}"
    resp = client.post("/auth/verify", json={"phone": phone, "code": wrong_code})
    assert resp.status_code == 400


def test_me_requires_auth(client):
    resp = client.get("/users/me")
    assert resp.status_code in (401, 403)
