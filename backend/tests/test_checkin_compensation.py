"""Coverage for the mutual-arrival / no-show-compensation feature:
both poster and joiner must independently geo-confirm arrival before a
joiner's deposit settles, and either side can claim compensation via
/resolve-no-show once the grace period has elapsed without the other side
showing up.
"""
from datetime import datetime, timedelta

from app.archive import archive_expired_events
from app.models import Deposit, EscrowStatus, Event, Participation, ParticipationStatus
from tests.conftest import register_user

EVENT_LAT = 58.0104
EVENT_LNG = 56.2502

# ~100m north of EVENT_LAT/LNG -- inside the default 150m arrival radius.
INSIDE_LAT = 58.01129831117499
# ~300m north -- outside the default 150m arrival radius.
OUTSIDE_LAT = 58.01309493352497


def make_past_event_payload(**overrides):
    payload = {
        "datetime": (datetime.utcnow() - timedelta(minutes=5)).isoformat(),
        "activity_type": "concert",
        "slots_total": 3,
        "deposit_amount": 50000,
        "location_lat": EVENT_LAT,
        "location_lng": EVENT_LNG,
    }
    payload.update(overrides)
    return payload


def _setup_event_with_joiner(client, poster_phone, joiner_phone, **event_overrides):
    poster = register_user(client, poster_phone)
    joiner = register_user(client, joiner_phone)
    event = client.post(
        "/events", json=make_past_event_payload(**event_overrides), headers=poster
    ).json()
    participation = client.post(f"/events/{event['id']}/join", headers=joiner).json()
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()
    return poster, joiner, event, participation, deposit


def _arrive_selfie(client, event_id, headers, lat=EVENT_LAT, lng=EVENT_LNG):
    return client.post(
        f"/events/{event_id}/confirm/selfie",
        json={"faces_detected": 2, "lat": lat, "lng": lng},
        headers=headers,
    )


# --- 2. Full happy path ---------------------------------------------------


def test_full_happy_path_settles_after_both_arrive(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001000", "+79990001001"
    )

    poster_deposit = client.post(
        f"/events/{event['id']}/poster-deposit", headers=poster
    ).json()
    assert poster_deposit["escrow_status"] == "held"

    resp = _arrive_selfie(client, event["id"], joiner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "waiting_for_organizer"

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "held"

    resp = _arrive_selfie(client, event["id"], poster)
    assert resp.status_code == 200
    assert resp.json()["status"] == "organizer_arrived"

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "released_to_payer"

    participation_after = client.get(
        f"/events/{event['id']}/participations/me", headers=joiner
    ).json()
    assert participation_after["status"] == "confirmed"


# --- 3. Order independence -------------------------------------------------


def test_order_independence_poster_first_then_joiner(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001002", "+79990001003"
    )

    resp = _arrive_selfie(client, event["id"], poster)
    assert resp.json()["status"] == "organizer_arrived"

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "held"

    resp = _arrive_selfie(client, event["id"], joiner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "released_to_payer"


# --- 4. Geo checks ----------------------------------------------------------


def test_arrival_outside_radius_rejected(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001004", "+79990001005"
    )
    resp = _arrive_selfie(client, event["id"], joiner, lat=OUTSIDE_LAT, lng=EVENT_LNG)
    assert resp.status_code == 400


def test_arrival_just_inside_radius_accepted(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001006", "+79990001007"
    )
    resp = _arrive_selfie(client, event["id"], joiner, lat=INSIDE_LAT, lng=EVENT_LNG)
    assert resp.status_code == 200
    assert resp.json()["status"] == "waiting_for_organizer"


def test_arrival_without_event_location_rejected(client):
    poster = register_user(client, "+79990001008")
    joiner = register_user(client, "+79990001009")
    payload = make_past_event_payload()
    payload["location_lat"] = None
    payload["location_lng"] = None
    event = client.post("/events", json=payload, headers=poster).json()
    client.post(f"/events/{event['id']}/join", headers=joiner)

    resp = _arrive_selfie(client, event["id"], joiner)
    assert resp.status_code == 400
    assert "точка встречи" in resp.json()["detail"]


# --- 5. Grace-period compensation: joiner arrived, poster never does -------


def _backdate_joiner_arrival(db_sessionmaker, participation_id, minutes_ago):
    db = db_sessionmaker()
    try:
        participation = db.query(Participation).filter(Participation.id == participation_id).first()
        participation.joiner_arrived_at = datetime.utcnow() - timedelta(minutes=minutes_ago)
        db.commit()
    finally:
        db.close()


def _backdate_poster_arrival(db_sessionmaker, event_id, minutes_ago):
    db = db_sessionmaker()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        event.poster_arrived_at = datetime.utcnow() - timedelta(minutes=minutes_ago)
        db.commit()
    finally:
        db.close()


def test_resolve_no_show_before_grace_period_rejected(client, db_sessionmaker):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001010", "+79990001011"
    )
    _arrive_selfie(client, event["id"], joiner)

    resp = client.post(
        f"/events/{event['id']}/resolve-no-show",
        json={"participation_id": participation["id"]},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_resolve_no_show_joiner_compensated_after_grace_period(client, db_sessionmaker):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001012", "+79990001013"
    )
    poster_deposit = client.post(
        f"/events/{event['id']}/poster-deposit", headers=poster
    ).json()

    _arrive_selfie(client, event["id"], joiner)
    _backdate_joiner_arrival(db_sessionmaker, participation["id"], minutes_ago=20)

    resp = client.post(
        f"/events/{event['id']}/resolve-no-show",
        json={"participation_id": participation["id"]},
        headers=joiner,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "compensated", "reason": "poster_absent"}

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "refunded"

    resp = client.get(f"/deposits/{poster_deposit['id']}", headers=poster)
    assert resp.json()["escrow_status"] == "forfeited"


def test_resolve_no_show_joiner_compensated_without_poster_deposit(client, db_sessionmaker):
    """No poster-deposit was ever created -- joiner should still get their
    own refund without the endpoint crashing."""
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001014", "+79990001015"
    )
    _arrive_selfie(client, event["id"], joiner)
    _backdate_joiner_arrival(db_sessionmaker, participation["id"], minutes_ago=20)

    resp = client.post(
        f"/events/{event['id']}/resolve-no-show",
        json={"participation_id": participation["id"]},
        headers=joiner,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "compensated"

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "refunded"


# --- 6. Symmetric case: poster arrived, a joiner never does ----------------


def test_resolve_no_show_poster_settles_absent_joiner(client, db_sessionmaker):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001016", "+79990001017"
    )
    _arrive_selfie(client, event["id"], poster)
    _backdate_poster_arrival(db_sessionmaker, event["id"], minutes_ago=20)

    resp = client.post(
        f"/events/{event['id']}/resolve-no-show",
        json={"participation_id": participation["id"]},
        headers=poster,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "compensated", "reason": "joiner_absent"}

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "released_to_poster"


# --- 7. Multi-joiner bulk settlement ----------------------------------------


def test_poster_arrival_bulk_settles_only_already_arrived_joiners(client):
    poster = register_user(client, "+79990001018")
    joiner_a = register_user(client, "+79990001019")
    joiner_b = register_user(client, "+79990001020")

    event = client.post(
        "/events", json=make_past_event_payload(slots_total=3), headers=poster
    ).json()

    part_a = client.post(f"/events/{event['id']}/join", headers=joiner_a).json()
    dep_a = client.post(
        "/deposits", json={"participation_id": part_a["id"]}, headers=joiner_a
    ).json()
    part_b = client.post(f"/events/{event['id']}/join", headers=joiner_b).json()
    dep_b = client.post(
        "/deposits", json={"participation_id": part_b["id"]}, headers=joiner_b
    ).json()

    # Only joiner A arrives before the poster does.
    resp = _arrive_selfie(client, event["id"], joiner_a)
    assert resp.json()["status"] == "waiting_for_organizer"

    resp = _arrive_selfie(client, event["id"], poster)
    assert resp.json()["status"] == "organizer_arrived"

    resp = client.get(f"/deposits/{dep_a['id']}", headers=joiner_a)
    assert resp.json()["escrow_status"] == "released_to_payer"

    # Joiner B never arrived -- untouched, still held.
    resp = client.get(f"/deposits/{dep_b['id']}", headers=joiner_b)
    assert resp.json()["escrow_status"] == "held"

    part_b_after = client.get(
        f"/events/{event['id']}/participations/me", headers=joiner_b
    ).json()
    assert part_b_after["status"] == "joined"


# --- 8. Authorization --------------------------------------------------------


def test_resolve_no_show_by_stranger_forbidden(client, db_sessionmaker):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001021", "+79990001022"
    )
    stranger = register_user(client, "+79990001023")
    _arrive_selfie(client, event["id"], joiner)
    _backdate_joiner_arrival(db_sessionmaker, participation["id"], minutes_ago=20)

    resp = client.post(
        f"/events/{event['id']}/resolve-no-show",
        json={"participation_id": participation["id"]},
        headers=stranger,
    )
    assert resp.status_code == 403


def test_resolve_no_show_joiner_cannot_claim_before_own_arrival(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001024", "+79990001025"
    )
    resp = client.post(
        f"/events/{event['id']}/resolve-no-show",
        json={"participation_id": participation["id"]},
        headers=joiner,
    )
    assert resp.status_code == 400


def test_poster_deposit_by_non_poster_forbidden(client):
    poster = register_user(client, "+79990001026")
    other = register_user(client, "+79990001027")
    event = client.post("/events", json=make_past_event_payload(), headers=poster).json()

    resp = client.post(f"/events/{event['id']}/poster-deposit", headers=other)
    assert resp.status_code == 403


def test_list_participations_is_poster_only(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001028", "+79990001029"
    )

    resp = client.get(f"/events/{event['id']}/participations", headers=joiner)
    assert resp.status_code == 403

    resp = client.get(f"/events/{event['id']}/participations", headers=poster)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == participation["id"]


def test_participations_me_works_for_calling_joiner(client):
    poster, joiner, event, participation, deposit = _setup_event_with_joiner(
        client, "+79990001030", "+79990001031"
    )
    resp = client.get(f"/events/{event['id']}/participations/me", headers=joiner)
    assert resp.status_code == 200
    assert resp.json()["id"] == participation["id"]


# --- 9. User ratings list ----------------------------------------------------


def test_user_ratings_list_returns_reviews_with_rater_name(client):
    poster = register_user(client, "+79990001032")
    joiner = register_user(client, "+79990001033")
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

    joiner_me = client.get("/users/me", headers=joiner).json()
    client.patch("/users/me", json={"name": "Anna"}, headers=joiner)
    poster_me = client.get("/users/me", headers=poster).json()

    client.post(
        f"/events/{event['id']}/rate",
        json={"rated_id": poster_me["id"], "stars": 5, "comment": "Great!"},
        headers=joiner,
    )

    resp = client.get(f"/users/{poster_me['id']}/ratings")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["stars"] == 5
    assert data[0]["comment"] == "Great!"
    assert data[0]["rater_name"] == "Anna"
    assert data[0]["rater_id"] == joiner_me["id"]


def test_user_ratings_list_empty_for_user_with_no_reviews(client):
    user = register_user(client, "+79990001034")
    user_me = client.get("/users/me", headers=user).json()

    resp = client.get(f"/users/{user_me['id']}/ratings")
    assert resp.status_code == 200
    assert resp.json() == []


# --- 10. Auto-archive fallback (2h) -----------------------------------------


def _make_expired_event(client, poster_headers):
    old_datetime = datetime.utcnow() - timedelta(hours=3)
    return client.post(
        "/events",
        json=make_past_event_payload(datetime=old_datetime.isoformat()),
        headers=poster_headers,
    ).json()


def test_archive_fallback_both_arrived_safety_net_settles(client, db_sessionmaker):
    poster = register_user(client, "+79990001035")
    joiner = register_user(client, "+79990001036")
    event = _make_expired_event(client, poster)
    participation = client.post(f"/events/{event['id']}/join", headers=joiner).json()
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()

    # Simulate both sides having arrived, but for some reason settlement
    # never got triggered (e.g. crashed mid-request) -- directly set the DB
    # flags without going through the confirm endpoints (those would reject
    # anyway since the meeting window has expired).
    db = db_sessionmaker()
    try:
        ev = db.query(Event).filter(Event.id == event["id"]).first()
        ev.poster_arrived_at = datetime.utcnow() - timedelta(hours=2, minutes=50)
        part = db.query(Participation).filter(Participation.id == participation["id"]).first()
        part.joiner_arrived_at = datetime.utcnow() - timedelta(hours=2, minutes=50)
        db.commit()
    finally:
        db.close()

    archived = archive_expired_events()
    assert archived >= 1

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "released_to_payer"


def test_archive_fallback_only_joiner_arrived_refunds_and_forfeits_poster(client, db_sessionmaker):
    poster = register_user(client, "+79990001037")
    joiner = register_user(client, "+79990001038")
    event = _make_expired_event(client, poster)
    participation = client.post(f"/events/{event['id']}/join", headers=joiner).json()
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()
    poster_deposit = client.post(f"/events/{event['id']}/poster-deposit", headers=poster).json()

    db = db_sessionmaker()
    try:
        part = db.query(Participation).filter(Participation.id == participation["id"]).first()
        part.joiner_arrived_at = datetime.utcnow() - timedelta(hours=2, minutes=50)
        db.commit()
    finally:
        db.close()

    archived = archive_expired_events()
    assert archived >= 1

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "refunded"

    resp = client.get(f"/deposits/{poster_deposit['id']}", headers=poster)
    assert resp.json()["escrow_status"] == "forfeited"


def test_archive_fallback_neither_arrived_classic_joiner_no_show(client):
    poster = register_user(client, "+79990001039")
    joiner = register_user(client, "+79990001040")
    event = _make_expired_event(client, poster)
    participation = client.post(f"/events/{event['id']}/join", headers=joiner).json()
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()

    archived = archive_expired_events()
    assert archived >= 1

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "released_to_poster"


def test_archive_fallback_only_poster_arrived_classic_joiner_no_show(client, db_sessionmaker):
    poster = register_user(client, "+79990001041")
    joiner = register_user(client, "+79990001042")
    event = _make_expired_event(client, poster)
    participation = client.post(f"/events/{event['id']}/join", headers=joiner).json()
    deposit = client.post(
        "/deposits", json={"participation_id": participation["id"]}, headers=joiner
    ).json()

    db = db_sessionmaker()
    try:
        ev = db.query(Event).filter(Event.id == event["id"]).first()
        ev.poster_arrived_at = datetime.utcnow() - timedelta(hours=2, minutes=50)
        db.commit()
    finally:
        db.close()

    archived = archive_expired_events()
    assert archived >= 1

    resp = client.get(f"/deposits/{deposit['id']}", headers=joiner)
    assert resp.json()["escrow_status"] == "released_to_poster"
