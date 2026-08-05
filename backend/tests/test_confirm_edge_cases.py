from datetime import datetime, timedelta

from tests.conftest import register_user


def make_future_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
    }
    payload.update(overrides)
    return payload


def make_past_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
    }
    payload.update(overrides)
    return payload


def test_selfie_confirm_before_meeting_time_rejected(client):
    poster = register_user(client, "+79990000400")
    joiner = register_user(client, "+79990000401")
    event = client.post(
        "/events", json=make_future_event_payload(), headers=poster
    ).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_selfie_confirm_zero_faces_rejected(client):
    poster = register_user(client, "+79990000402")
    joiner = register_user(client, "+79990000403")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 0},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_selfie_confirm_negative_faces_rejected(client):
    """Edge/boundary input: faces_detected is a plain int with no ge=0 constraint,
    so a negative value is accepted by validation but still correctly rejected
    by the '< 2' business check (not a crash)."""
    poster = register_user(client, "+79990000404")
    joiner = register_user(client, "+79990000405")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": -5},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_selfie_confirm_by_non_participant_forbidden(client):
    poster = register_user(client, "+79990000406")
    joiner = register_user(client, "+79990000407")
    stranger = register_user(client, "+79990000408")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2},
        headers=stranger,
    )
    assert resp.status_code == 403


def test_qr_scan_wrong_token_rejected(client):
    poster = register_user(client, "+79990000409")
    joiner = register_user(client, "+79990000410")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    client.post(f"/events/{event['id']}/confirm/qr/generate", headers=poster)

    resp = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": "totally-wrong-token"},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_qr_scan_without_generation_rejected(client):
    poster = register_user(client, "+79990000411")
    joiner = register_user(client, "+79990000412")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": "anything"},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_qr_scan_token_cannot_be_reused(client):
    poster = register_user(client, "+79990000413")
    joiner = register_user(client, "+79990000414")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    qr = client.post(
        f"/events/{event['id']}/confirm/qr/generate", headers=poster
    ).json()

    first = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": qr["qr_token"]},
        headers=joiner,
    )
    assert first.status_code == 200

    second = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": qr["qr_token"]},
        headers=joiner,
    )
    assert second.status_code == 400


def test_qr_generate_by_non_poster_forbidden(client):
    poster = register_user(client, "+79990000415")
    joiner = register_user(client, "+79990000416")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(f"/events/{event['id']}/confirm/qr/generate", headers=joiner)
    assert resp.status_code == 403


def test_rating_zero_stars_rejected(client):
    poster = register_user(client, "+79990000417")
    joiner = register_user(client, "+79990000418")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 0},
        headers=joiner,
    )
    assert resp.status_code == 422


def test_rating_six_stars_rejected(client):
    poster = register_user(client, "+79990000419")
    joiner = register_user(client, "+79990000420")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 6},
        headers=joiner,
    )
    assert resp.status_code == 422


def test_rating_negative_stars_rejected(client):
    poster = register_user(client, "+79990000421")
    joiner = register_user(client, "+79990000422")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": -1},
        headers=joiner,
    )
    assert resp.status_code == 422


def test_rating_for_nonexistent_user_id_does_not_crash(client):
    """Bug / gap: rate_participant never validates that rated_id refers to an
    existing user before creating the Rating row — it only looks the user up
    afterwards to update the aggregate, and silently skips the aggregate update
    if not found. Documents that this does not crash (200/201) rather than 404."""
    poster = register_user(client, "+79990000423")
    joiner = register_user(client, "+79990000424")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": "does-not-exist", "stars": 5},
        headers=joiner,
    )
    assert resp.status_code == 201


def test_self_rating_not_prevented(client):
    """Bug / gap: nothing stops a user from rating themselves (rater_id == rated_id)."""
    poster = register_user(client, "+79990000425")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5},
        headers=poster,
    )
    assert resp.status_code == 201


def test_rating_before_meeting_time_not_prevented(client):
    """Bug / gap: rate_participant does not check event.datetime_ at all (unlike
    the confirm endpoints), so a rating can be submitted for an event that
    hasn't happened yet."""
    poster = register_user(client, "+79990000426")
    joiner = register_user(client, "+79990000427")
    event = client.post(
        "/events", json=make_future_event_payload(), headers=poster
    ).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 4},
        headers=joiner,
    )
    assert resp.status_code == 201


def test_confirm_selfie_nonexistent_event_returns_404(client):
    headers = register_user(client, "+79990000428")
    resp = client.post(
        "/events/does-not-exist/confirm/selfie",
        json={"faces_detected": 2},
        headers=headers,
    )
    assert resp.status_code == 404
