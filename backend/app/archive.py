import asyncio
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import Event, EventStatus

CHECK_INTERVAL_SECONDS = 300


def archive_expired_events() -> int:
    """Архивирует события, где прошло больше 2 часов с момента встречи."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=2)
        expired = (
            db.query(Event)
            .filter(Event.status == EventStatus.active, Event.datetime_ < cutoff)
            .all()
        )
        for event in expired:
            event.status = EventStatus.archived
        db.commit()
        return len(expired)
    finally:
        db.close()


async def auto_archive_loop():
    while True:
        archive_expired_events()
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
