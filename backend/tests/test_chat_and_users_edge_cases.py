from datetime import datetime, timedelta

from tests.conftest import register_user


def make_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
    }
    payload.update(overrides)
    return payload


def test_non_participant_cannot_read_messages(client):
    poster = register_user(client, "+79990000500")
    stranger = register_user(client, "+79990000501")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()

    resp = client.get(f"/events/{event['id']}/messages", headers=stranger)
    assert resp.status_code == 403


def test_non_participant_cannot_post_messages(client):
    poster = register_user(client, "+79990000502")
    stranger = register_user(client, "+79990000503")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/messages", json={"text": "hi"}, headers=stranger
    )
    assert resp.status_code == 403


def test_poster_can_read_and_post_messages_without_joining(client):
    poster = register_user(client, "+79990000504")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/messages", json={"text": "Всем привет"}, headers=poster
    )
    assert resp.status_code == 201

    resp = client.get(f"/events/{event['id']}/messages", headers=poster)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_participant_can_read_and_post_messages(client):
    poster = register_user(client, "+79990000505")
    joiner = register_user(client, "+79990000506")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/messages", json={"text": "Привет!"}, headers=joiner
    )
    assert resp.status_code == 201

    resp = client.get(f"/events/{event['id']}/messages", headers=joiner)
    assert resp.status_code == 200
    assert resp.json()[0]["text"] == "Привет!"


def test_empty_message_text_accepted_without_validation(client):
    """No min_length constraint on MessageCreate.text — an empty string is stored
    as a message via the REST endpoint (unlike the websocket path, which skips
    blank text after stripping)."""
    poster = register_user(client, "+79990000507")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/messages", json={"text": ""}, headers=poster
    )
    assert resp.status_code == 201


def test_messages_for_nonexistent_event_returns_404(client):
    headers = register_user(client, "+79990000508")
    resp = client.get("/events/does-not-exist/messages", headers=headers)
    assert resp.status_code == 404


def test_get_public_profile_for_nonexistent_user_returns_404(client):
    resp = client.get("/users/does-not-exist")
    assert resp.status_code == 404


def test_update_profile_empty_interests_list(client):
    headers = register_user(client, "+79990000509")
    resp = client.patch("/users/me", json={"interests": []}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["interests"] == []


def test_update_profile_partial_update_preserves_other_fields(client):
    headers = register_user(client, "+79990000510")
    client.patch("/users/me", json={"name": "Аня", "age": 25}, headers=headers)
    resp = client.patch("/users/me", json={"age": 26}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Аня"
    assert body["age"] == 26


def test_block_user_endpoint_does_not_persist_anything(client):
    """Gap: POST /users/{id}/block is a documented no-op on the server (comment in
    users.py says blocking is handled client-side for MVP). It always succeeds
    regardless of whether the target user exists, and has no observable effect
    (e.g. it does not prevent further messaging or event joins between the two
    users) — this is weaker than SPEC.md section 9's "Заблокировать" profile
    action might imply, though CHANGES.md doesn't call it out as a stub."""
    poster = register_user(client, "+79990000511")
    resp = client.post("/users/does-not-exist/block", headers=poster)
    assert resp.status_code == 204


def test_report_user_with_nonexistent_target_does_not_crash(client):
    headers = register_user(client, "+79990000512")
    resp = client.post(
        "/users/does-not-exist/report",
        json={"reason": "spam"},
        headers=headers,
    )
    assert resp.status_code == 204
