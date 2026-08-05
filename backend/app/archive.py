import asyncio
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import EscrowStatus, Event, EventStatus, Participation, ParticipationStatus

CHECK_INTERVAL_SECONDS = 300


def _settle_unconfirmed_as_no_show(db, event: Event) -> None:
    """Никто не подтвердил встречу до архивации — депозит уходит постеру (правила no-show)."""
    participations = (
        db.query(Participation)
        .filter(
            Participation.event_id == event.id,
            Participation.status == ParticipationStatus.joined,
        )
        .all()
    )
    for p in participations:
        p.status = ParticipationStatus.no_show
        deposit = p.deposit
        if deposit and deposit.escrow_status == EscrowStatus.held:
            deposit.escrow_status = EscrowStatus.released_to_poster


def archive_expired_events() -> int:
    """Архивирует события, где прошло больше 2 часов с момента встречи, и обрабатывает no-show."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=2)
        expired = (
            db.query(Event)
            .filter(Event.status == EventStatus.active, Event.datetime_ < cutoff)
            .all()
        )
        for event in expired:
            _settle_unconfirmed_as_no_show(db, event)
            event.status = EventStatus.archived
        db.commit()
        return len(expired)
    finally:
        db.close()


async def auto_archive_loop():
    while True:
        archive_expired_events()
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
