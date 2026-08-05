from datetime import datetime, timedelta

from tests.conftest import register_user


def make_past_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
    }
    payload.update(overrides)
    return payload


def test_selfie_confirm_settles_deposit(client):
    poster_headers = register_user(client, "+79990000020")
    joiner_headers = register_user(client, "+79990000021")

    event = client.post(
        "/events", json=make_past_event_payload(), headers=poster_headers
    ).json()
    participation = client.post(f"/events/{event['id']}/join", headers=joiner_headers).json()
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner_headers
    ).json()

    resp = client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2, "filter_name": "cat"},
        headers=joiner_headers,
    )
    assert resp.status_code == 200, resp.text

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner_headers)
    assert resp.json()["escrow_status"] == "released_to_payer"


def test_selfie_confirm_requires_two_faces(client):
    poster_headers = register_user(client, "+79990000022")
    joiner_headers = register_user(client, "+79990000023")

    event = client.post(
        "/events", json=make_past_event_payload(), headers=poster_headers
    ).json()
    client.post(f"/events/{event['id']}/join", headers=joiner_headers)

    resp = client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 1},
        headers=joiner_headers,
    )
    assert resp.status_code == 400


def test_qr_confirm_flow(client):
    poster_headers = register_user(client, "+79990000024")
    joiner_headers = register_user(client, "+79990000025")

    event = client.post(
        "/events", json=make_past_event_payload(), headers=poster_headers
    ).json()
    client.post(f"/events/{event['id']}/join", headers=joiner_headers)

    qr = client.post(
        f"/events/{event['id']}/confirm/qr/generate", headers=poster_headers
    ).json()
    resp = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": qr["qr_token"]},
        headers=joiner_headers,
    )
    assert resp.status_code == 200, resp.text


def test_rating_updates_average(client):
    poster_headers = register_user(client, "+79990000026")
    joiner_headers = register_user(client, "+79990000027")

    event = client.post(
        "/events", json=make_past_event_payload(), headers=poster_headers
    ).json()
    client.post(f"/events/{event['id']}/join", headers=joiner_headers)

    poster_me = client.get("/users/me", headers=poster_headers).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5, "comment": "Отлично"},
        headers=joiner_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/users/{poster_me['id']}")
    assert resp.json()["rating_avg"] == 5.0
