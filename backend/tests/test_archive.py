from datetime import datetime, timedelta

from app.archive import archive_expired_events
from app.database import SessionLocal
from app.models import Event, EventStatus
from tests.conftest import register_user


def test_expired_event_gets_archived(client):
    poster_headers = register_user(client, "+79990000030")
    old_datetime = datetime.utcnow() - timedelta(hours=3)
    resp = client.post(
        "/events",
        json={
            "datetime": old_datetime.isoformat(),
            "activity_type": "concert",
            "slots_total": 1,
            "deposit_amount": 10000,
        },
        headers=poster_headers,
    )
    event_id = resp.json()["id"]

    archived_count = archive_expired_events()
    assert archived_count >= 1

    resp = client.get(f"/events/{event_id}", headers=poster_headers)
    assert resp.json()["status"] == "archived"
