from datetime import datetime, timedelta

from tests.conftest import register_user

EVENT_LAT = 58.0104
EVENT_LNG = 56.2502


def make_future_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
        "location_lat": EVENT_LAT,
        "location_lng": EVENT_LNG,
    }
    payload.update(overrides)
    return payload


def make_past_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
        "activity_type": "concert",
        "slots_total": 1,
        "deposit_amount": 50000,
        "location_lat": EVENT_LAT,
        "location_lng": EVENT_LNG,
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
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
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
        json={"faces_detected": 0, "lat": EVENT_LAT, "lng": EVENT_LNG},
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
        json={"faces_detected": -5, "lat": EVENT_LAT, "lng": EVENT_LNG},
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
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=stranger,
    )
    assert resp.status_code == 403


def test_qr_scan_wrong_token_rejected(client):
    poster = register_user(client, "+79990000409")
    joiner = register_user(client, "+79990000410")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    client.post(
        f"/events/{event['id']}/confirm/qr/generate",
        json={"lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=poster,
    )

    resp = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": "totally-wrong-token", "lat": EVENT_LAT, "lng": EVENT_LNG},
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
        json={"qr_token": "anything", "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_qr_scan_token_cannot_be_reused(client):
    poster = register_user(client, "+79990000413")
    joiner = register_user(client, "+79990000414")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    qr = client.post(
        f"/events/{event['id']}/confirm/qr/generate",
        json={"lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=poster,
    ).json()

    first = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": qr["qr_token"], "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=joiner,
    )
    assert first.status_code == 200

    second = client.post(
        f"/events/{event['id']}/confirm/qr/scan",
        json={"qr_token": qr["qr_token"], "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=joiner,
    )
    assert second.status_code == 400


def test_qr_generate_by_non_poster_forbidden(client):
    poster = register_user(client, "+79990000415")
    joiner = register_user(client, "+79990000416")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = client.post(
        f"/events/{event['id']}/confirm/qr/generate",
        json={"lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=joiner,
    )
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


def test_rating_for_nonexistent_user_id_rejected(client):
    poster = register_user(client, "+79990000423")
    joiner = register_user(client, "+79990000424")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=joiner,
    )
    client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=poster,
    )

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": "does-not-exist", "stars": 5},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_self_rating_rejected(client):
    poster = register_user(client, "+79990000425")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5},
        headers=poster,
    )
    assert resp.status_code == 400


def test_rating_before_meeting_time_rejected(client):
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
    assert resp.status_code == 400


def test_rating_by_non_participant_forbidden(client):
    poster = register_user(client, "+79990000429")
    joiner = register_user(client, "+79990000430")
    stranger = register_user(client, "+79990000431")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5},
        headers=stranger,
    )
    assert resp.status_code == 403


def test_rating_joined_but_not_confirmed_forbidden(client):
    """A joiner who never geo-confirmed arrival (still 'joined', not
    'confirmed') cannot rate — rating is limited to people who actually
    attended the meeting."""
    poster = register_user(client, "+79990000432")
    joiner = register_user(client, "+79990000433")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    resp = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5},
        headers=joiner,
    )
    assert resp.status_code == 403


def test_duplicate_rating_rejected(client):
    poster = register_user(client, "+79990000434")
    joiner = register_user(client, "+79990000435")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)
    client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=joiner,
    )
    client.post(
        f"/events/{event['id']}/confirm/selfie",
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=poster,
    )
    poster_me = client.get("/users/me", headers=poster).json()

    first = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5},
        headers=joiner,
    )
    assert first.status_code == 201

    second = client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 3},
        headers=joiner,
    )
    assert second.status_code == 400


def test_confirm_selfie_nonexistent_event_returns_404(client):
    headers = register_user(client, "+79990000428")
    resp = client.post(
        "/events/does-not-exist/confirm/selfie",
        json={"faces_detected": 2, "lat": EVENT_LAT, "lng": EVENT_LNG},
        headers=headers,
    )
    assert resp.status_code == 404
