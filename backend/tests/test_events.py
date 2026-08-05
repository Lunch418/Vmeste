from datetime import datetime, timedelta

from tests.conftest import register_user


def make_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
        "description": "Идём на концерт",
    }
    payload.update(overrides)
    return payload


def test_create_and_list_event(client):
    poster_headers = register_user(client, "+79990000010")
    resp = client.post("/events", json=make_event_payload(), headers=poster_headers)
    assert resp.status_code == 201, resp.text
    event = resp.json()
    assert event["slots_taken"] == 0

    resp = client.get("/events", params={"city": event["city"]})
    assert resp.status_code == 200
    assert any(e["id"] == event["id"] for e in resp.json())


def test_join_and_deposit_flow(client):
    poster_headers = register_user(client, "+79990000011")
    joiner_headers = register_user(client, "+79990000012")

    event = client.post("/events", json=make_event_payload(), headers=poster_headers).json()

    resp = client.post(f"/events/{event['id']}/join", headers=joiner_headers)
    assert resp.status_code == 201, resp.text
    participation = resp.json()

    resp = client.get(f"/events/{event['id']}", headers=joiner_headers)
    assert resp.json()["slots_taken"] == 1

    resp = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner_headers
    )
    assert resp.status_code == 201, resp.text
    deposit = resp.json()
    assert deposit["escrow_status"] == "held"


def test_poster_cannot_join_own_event(client):
    poster_headers = register_user(client, "+79990000013")
    event = client.post("/events", json=make_event_payload(), headers=poster_headers).json()
    resp = client.post(f"/events/{event['id']}/join", headers=poster_headers)
    assert resp.status_code == 400


def test_join_full_event_rejected(client):
    poster_headers = register_user(client, "+79990000014")
    joiner1 = register_user(client, "+79990000015")
    joiner2 = register_user(client, "+79990000016")

    event = client.post(
        "/events", json=make_event_payload(slots_total=1), headers=poster_headers
    ).json()

    assert client.post(f"/events/{event['id']}/join", headers=joiner1).status_code == 201
    resp = client.post(f"/events/{event['id']}/join", headers=joiner2)
    assert resp.status_code == 400
