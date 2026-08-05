import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    Deposit,
    EscrowStatus,
    Event,
    EventStatus,
    Participation,
    ParticipationStatus,
    Rating,
    User,
)
from app.schemas import QrGenerateOut, QrScan, RatingCreate, SelfieConfirm
from app.security import get_current_user

router = APIRouter(prefix="/events", tags=["confirm"])

# event_id -> qr_token (в памяти, для MVP; на проде — Redis с TTL)
_qr_tokens: dict[str, str] = {}


def _get_own_participation(db: Session, event_id: str, user_id: str) -> tuple[Event, Participation]:
    """Подтверждение встречи доступно только участнику для его собственного участия —
    ни постер, ни другой участник не могут подтвердить/списать чужой депозит."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if event.status != EventStatus.active:
        raise HTTPException(status_code=400, detail="Событие неактивно")
    if datetime.utcnow() < event.datetime_:
        raise HTTPException(status_code=400, detail="Подтверждение доступно только во время встречи")
    deadline = event.datetime_ + timedelta(minutes=settings.meeting_confirm_window_minutes)
    if datetime.utcnow() > deadline:
        raise HTTPException(status_code=400, detail="Окно подтверждения истекло")

    participation = (
        db.query(Participation)
        .filter(Participation.event_id == event_id, Participation.user_id == user_id)
        .first()
    )
    if not participation:
        raise HTTPException(status_code=403, detail="Вы не участник этого события")
    if participation.status != ParticipationStatus.joined:
        raise HTTPException(status_code=400, detail="Участие уже обработано")
    return event, participation


def _settle_participation(db: Session, participation: Participation, confirmed: bool):
    participation.status = ParticipationStatus.confirmed if confirmed else ParticipationStatus.no_show
    deposit = participation.deposit
    if deposit and deposit.escrow_status == EscrowStatus.held:
        deposit.escrow_status = (
            EscrowStatus.released_to_payer if confirmed else EscrowStatus.released_to_poster
        )
    db.commit()


@router.post("/{event_id}/confirm/selfie", status_code=200)
def confirm_selfie(
    event_id: str,
    payload: SelfieConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, participation = _get_own_participation(db, event_id, current_user.id)
    if payload.faces_detected < 2:
        raise HTTPException(status_code=400, detail="Для подтверждения нужно 2 лица в кадре")
    _settle_participation(db, participation, confirmed=True)
    return {"status": "confirmed"}


@router.post("/{event_id}/confirm/qr/generate", response_model=QrGenerateOut)
def generate_qr(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if event.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="QR генерирует только постер")
    token = secrets.token_urlsafe(16)
    _qr_tokens[event_id] = token
    return QrGenerateOut(qr_token=token)


@router.post("/{event_id}/confirm/qr/scan", status_code=200)
def scan_qr(
    event_id: str,
    payload: QrScan,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, participation = _get_own_participation(db, event_id, current_user.id)
    expected = _qr_tokens.get(event_id)
    if not expected or expected != payload.qr_token:
        raise HTTPException(status_code=400, detail="Неверный или истёкший QR-код")
    del _qr_tokens[event_id]
    _settle_participation(db, participation, confirmed=True)
    return {"status": "confirmed"}


@router.post("/{event_id}/rate", status_code=201)
def rate_participant(
    event_id: str,
    payload: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    rating = Rating(
        event_id=event_id,
        rater_id=current_user.id,
        rated_id=payload.rated_id,
        stars=payload.stars,
        comment=payload.comment,
    )
    db.add(rating)
    db.flush()

    rated_user = db.query(User).filter(User.id == payload.rated_id).first()
    if rated_user:
        prior = db.query(Rating).filter(Rating.rated_id == rated_user.id).all()
        total_stars = sum(r.stars for r in prior)
        rated_user.rating_avg = round(total_stars / len(prior), 2)
        rated_user.meetings_count += 1

    db.commit()
    return {"status": "rated"}
