import asyncio
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import EscrowStatus, Event, EventStatus, Participation, ParticipationStatus

CHECK_INTERVAL_SECONDS = 300


def _settle_unconfirmed_as_no_show(db, event: Event) -> None:
    """Никто явно не подтвердил встречу до автоархивации (2ч) — фолбэк на
    случай, если стороны не вызвали /resolve-no-show вручную в течение
    грейс-периода. Учитывает, кто из сторон реально отмечался как пришедший
    (event.poster_arrived_at / Participation.joiner_arrived_at)."""
    participations = (
        db.query(Participation)
        .filter(
            Participation.event_id == event.id,
            Participation.status == ParticipationStatus.joined,
        )
        .all()
    )
    poster_deposit_forfeited = False
    for p in participations:
        both_arrived = event.poster_arrived_at is not None and p.joiner_arrived_at is not None
        if both_arrived:
            # Защитный случай — обе стороны отметились, но расчёт почему-то не прошёл раньше.
            p.status = ParticipationStatus.confirmed
            if p.deposit and p.deposit.escrow_status == EscrowStatus.held:
                p.deposit.escrow_status = EscrowStatus.released_to_payer
            continue

        if p.joiner_arrived_at is not None and event.poster_arrived_at is None:
            # Джойнер пришёл, постер — нет: джойнеру возврат, постеру форфейт.
            p.status = ParticipationStatus.no_show
            p.no_show_reason = "poster_absent"
            if p.deposit and p.deposit.escrow_status == EscrowStatus.held:
                p.deposit.escrow_status = EscrowStatus.refunded
            if not poster_deposit_forfeited and event.poster_deposit and event.poster_deposit.escrow_status == EscrowStatus.held:
                event.poster_deposit.escrow_status = EscrowStatus.forfeited
                poster_deposit_forfeited = True
        else:
            # Джойнер не отметился (постер пришёл или нет — не важно): классический no-show джойнера.
            p.status = ParticipationStatus.no_show
            p.no_show_reason = "joiner_absent"
            if p.deposit and p.deposit.escrow_status == EscrowStatus.held:
                p.deposit.escrow_status = EscrowStatus.released_to_poster


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
