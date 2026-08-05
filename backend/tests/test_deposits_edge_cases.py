from datetime import datetime, timedelta

from tests.conftest import register_user


def make_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "activity_type": "concert",
        "slots_total": 3,
        "deposit_amount": 50000,
        "description": "Идём на концерт",
    }
    payload.update(overrides)
    return payload


def _join(client, poster, joiner, **overrides):
    event = client.post("/events", json=make_event_payload(**overrides), headers=poster).json()
    participation = client.post(f"/events/{event['id']}/join", headers=joiner).json()
    return event, participation


def test_double_deposit_creation_rejected(client):
    poster = register_user(client, "+79990000300")
    joiner = register_user(client, "+79990000301")
    _, participation = _join(client, poster, joiner)

    first = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    )
    assert first.status_code == 201

    second = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    )
    assert second.status_code == 400


def test_deposit_for_nonexistent_participation_returns_404(client):
    headers = register_user(client, "+79990000302")
    resp = client.post(
        "/deposits", json={"participation_id": "does-not-exist"}, headers=headers
    )
    assert resp.status_code == 404


def test_deposit_for_someone_elses_participation_forbidden(client):
    poster = register_user(client, "+79990000303")
    joiner = register_user(client, "+79990000304")
    intruder = register_user(client, "+79990000305")
    _, participation = _join(client, poster, joiner)

    resp = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=intruder
    )
    assert resp.status_code == 403


def test_refund_by_non_payer_forbidden(client):
    poster = register_user(client, "+79990000306")
    joiner = register_user(client, "+79990000307")
    intruder = register_user(client, "+79990000308")
    _, participation = _join(client, poster, joiner)
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()

    resp = client.post(f"/deposits/{deposit['id']}/refund", headers=intruder)
    assert resp.status_code == 403


def test_double_refund_rejected(client):
    poster = register_user(client, "+79990000309")
    joiner = register_user(client, "+79990000310")
    _, participation = _join(client, poster, joiner)
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()

    first = client.post(f"/deposits/{deposit['id']}/refund", headers=joiner)
    assert first.status_code == 200

    second = client.post(f"/deposits/{deposit['id']}/refund", headers=joiner)
    assert second.status_code == 400


def test_webhook_for_nonexistent_deposit_returns_404(client):
    resp = client.post("/deposits/does-not-exist/webhook")
    assert resp.status_code == 404


def test_get_deposit_by_unrelated_user_not_forbidden(client):
    """Bug / gap: GET /deposits/{id} only checks that the deposit exists — it never
    verifies that current_user is the payer, the event poster, or otherwise
    related to the participation. Any authenticated user can read any other
    user's deposit amount and escrow status by guessing/enumerating the id."""
    poster = register_user(client, "+79990000311")
    joiner = register_user(client, "+79990000312")
    stranger = register_user(client, "+79990000313")
    _, participation = _join(client, poster, joiner)
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()

    resp = client.get(f"/deposits/{deposit['id']}", headers=stranger)
    assert resp.status_code == 200  # documents missing authorization check


def test_get_deposit_without_auth_rejected(client):
    resp = client.get("/deposits/does-not-exist")
    assert resp.status_code in (401, 403)
