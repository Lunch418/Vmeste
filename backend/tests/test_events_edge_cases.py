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


def test_create_event_missing_required_field_returns_422(client):
    headers = register_user(client, "+79990000200")
    payload = make_event_payload()
    del payload["activity_type"]
    resp = client.post("/events", json=payload, headers=headers)
    assert resp.status_code == 422


def test_create_event_without_auth_rejected(client):
    resp = client.post("/events", json=make_event_payload())
    assert resp.status_code in (401, 403)


def test_create_event_negative_deposit_accepted_without_validation(client):
    """No server-side validation on deposit_amount >= 0 in schemas.EventCreate.
    Documents that a negative deposit is currently accepted."""
    headers = register_user(client, "+79990000201")
    resp = client.post(
        "/events", json=make_event_payload(deposit_amount=-100), headers=headers
    )
    assert resp.status_code == 201
    assert resp.json()["deposit_amount"] == -100


def test_create_event_zero_slots_accepted(client):
    headers = register_user(client, "+79990000202")
    resp = client.post("/events", json=make_event_payload(slots_total=0), headers=headers)
    assert resp.status_code == 201


def test_join_event_with_zero_slots_rejected(client):
    poster = register_user(client, "+79990000203")
    joiner = register_user(client, "+79990000204")
    event = client.post(
        "/events", json=make_event_payload(slots_total=0), headers=poster
    ).json()
    resp = client.post(f"/events/{event['id']}/join", headers=joiner)
    assert resp.status_code == 400


def test_create_event_age_min_greater_than_age_max_accepted_without_validation(client):
    """No validation ensuring age_min <= age_max."""
    headers = register_user(client, "+79990000205")
    resp = client.post(
        "/events", json=make_event_payload(age_min=50, age_max=20), headers=headers
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["age_min"] == 50 and body["age_max"] == 20


def test_join_nonexistent_event_returns_404(client):
    headers = register_user(client, "+79990000206")
    resp = client.post("/events/does-not-exist/join", headers=headers)
    assert resp.status_code == 404


def test_join_cancelled_event_rejected(client):
    poster = register_user(client, "+79990000207")
    joiner = register_user(client, "+79990000208")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()
    cancel_resp = client.delete(f"/events/{event['id']}", headers=poster)
    assert cancel_resp.status_code == 204

    resp = client.post(f"/events/{event['id']}/join", headers=joiner)
    assert resp.status_code == 404


def test_double_join_same_event_rejected(client):
    poster = register_user(client, "+79990000209")
    joiner = register_user(client, "+79990000210")
    event = client.post(
        "/events", json=make_event_payload(slots_total=5), headers=poster
    ).json()
    first = client.post(f"/events/{event['id']}/join", headers=joiner)
    assert first.status_code == 201
    second = client.post(f"/events/{event['id']}/join", headers=joiner)
    assert second.status_code == 400


def test_non_poster_cannot_cancel_event(client):
    poster = register_user(client, "+79990000211")
    other = register_user(client, "+79990000212")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()
    resp = client.delete(f"/events/{event['id']}", headers=other)
    assert resp.status_code == 403


def test_non_poster_cannot_update_event(client):
    poster = register_user(client, "+79990000213")
    other = register_user(client, "+79990000214")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()
    resp = client.patch(
        f"/events/{event['id']}", json={"description": "hacked"}, headers=other
    )
    assert resp.status_code == 403


def test_leave_without_joining_returns_404(client):
    poster = register_user(client, "+79990000215")
    other = register_user(client, "+79990000216")
    event = client.post("/events", json=make_event_payload(), headers=poster).json()
    resp = client.post(f"/events/{event['id']}/leave", headers=other)
    assert resp.status_code == 404


def test_double_leave_double_decrements_slots_taken(client):
    """Bug: leave_event does not check participation.status before setting it to
    cancelled again, so calling /leave twice decrements slots_taken twice even
    though only one seat was ever freed. See repro below."""
    poster = register_user(client, "+79990000217")
    joiner = register_user(client, "+79990000218")
    event = client.post(
        "/events", json=make_event_payload(slots_total=1), headers=poster
    ).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    first_leave = client.post(f"/events/{event['id']}/leave", headers=joiner)
    assert first_leave.status_code == 204
    second_leave = client.post(f"/events/{event['id']}/leave", headers=joiner)
    # Currently returns 204 again instead of 404/400 — participation already cancelled.
    assert second_leave.status_code == 204

    after = client.get(f"/events/{event['id']}", headers=poster).json()
    # slots_taken went from 1 -> 0 after the first leave, but the second leave call
    # does not guard against re-decrementing (only guards slots_taken > 0), so this
    # assertion documents that it stays clamped at 0 rather than going negative —
    # still, the double state transition happening at all is the bug worth flagging.
    assert after["slots_taken"] == 0


def test_get_nonexistent_event_returns_404(client):
    resp = client.get("/events/does-not-exist")
    assert resp.status_code == 404


def test_gender_and_age_filters_not_enforced_on_join(client):
    """Bug / gap: SPEC.md section 6 defines Event.age_range and gender_filter, and
    the event card is supposed to show them, but POST /events/{id}/join never
    checks the joining user's age or gender against these fields. A joiner outside
    the stated age range or excluded gender can still join."""
    poster = register_user(client, "+79990000219")
    joiner = register_user(client, "+79990000220")
    # joiner sets an age well outside the event's allowed range
    client.patch("/users/me", json={"age": 15}, headers=joiner)

    event = client.post(
        "/events",
        json=make_event_payload(age_min=30, age_max=40, gender_filter="female"),
        headers=poster,
    ).json()

    resp = client.post(f"/events/{event['id']}/join", headers=joiner)
    assert resp.status_code == 201  # documents lack of enforcement
