import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.geo import distance_meters
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
from app.schemas import (
    QrGenerate,
    QrGenerateOut,
    QrScan,
    RatingCreate,
    ResolveNoShow,
    SelfieConfirm,
)
from app.security import get_current_user

router = APIRouter(prefix="/events", tags=["confirm"])

# event_id -> qr_token (в памяти, для MVP; на проде — Redis с TTL)
_qr_tokens: dict[str, str] = {}


def _check_window_and_geo(event: Event, lat: float, lng: float) -> None:
    if event.status != EventStatus.active:
        raise HTTPException(status_code=400, detail="Событие неактивно")
    if datetime.utcnow() < event.datetime_:
        raise HTTPException(status_code=400, detail="Подтверждение доступно только во время встречи")
    deadline = event.datetime_ + timedelta(minutes=settings.meeting_confirm_window_minutes)
    if datetime.utcnow() > deadline:
        raise HTTPException(status_code=400, detail="Окно подтверждения истекло")
    if event.location_lat is None or event.location_lng is None:
        raise HTTPException(status_code=400, detail="У события не указана точка встречи на карте")
    dist = distance_meters(lat, lng, event.location_lat, event.location_lng)
    if dist > settings.arrival_radius_meters:
        raise HTTPException(
            status_code=400,
            detail=f"Вы слишком далеко от точки встречи ({int(dist)} м, нужно ≤{int(settings.arrival_radius_meters)} м)",
        )


def _get_event_locked_or_404(db: Session, event_id: str) -> Event:
    """Блокирует строку события на время расчёта эскроу — без этого
    параллельные запросы (постер и джойнер почти одновременно, или
    ручной resolve-no-show против фонового archive_expired_events) могут
    оба пройти проверки состояния до того, как другой закоммитит свои
    изменения, и посчитать один и тот же депозит дважды/противоречиво."""
    event = db.query(Event).filter(Event.id == event_id).with_for_update().first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    return event


def _get_own_joined_participation_locked(db: Session, event_id: str, user_id: str) -> Participation:
    participation = (
        db.query(Participation)
        .filter(Participation.event_id == event_id, Participation.user_id == user_id)
        .with_for_update()
        .first()
    )
    if not participation:
        raise HTTPException(status_code=403, detail="Вы не участник этого события")
    if participation.status != ParticipationStatus.joined:
        raise HTTPException(status_code=400, detail="Участие уже обработано")
    return participation


def _settle_participation(participation: Participation, confirmed: bool, reason: Optional[str] = None):
    participation.status = ParticipationStatus.confirmed if confirmed else ParticipationStatus.no_show
    if reason:
        participation.no_show_reason = reason
    deposit = participation.deposit
    if deposit and deposit.escrow_status == EscrowStatus.held:
        deposit.escrow_status = (
            EscrowStatus.released_to_payer if confirmed else EscrowStatus.released_to_poster
        )


def _settle_pending_joiners(db: Session, event: Event) -> None:
    """Постер отметился — расчитать всех джойнеров, которые уже отметились раньше."""
    pending = (
        db.query(Participation)
        .filter(
            Participation.event_id == event.id,
            Participation.status == ParticipationStatus.joined,
            Participation.joiner_arrived_at.isnot(None),
        )
        .with_for_update()
        .all()
    )
    for p in pending:
        _settle_participation(p, confirmed=True)


def _mark_poster_arrived(db: Session, event: Event) -> None:
    if event.poster_arrived_at is None:
        event.poster_arrived_at = datetime.utcnow()
    _settle_pending_joiners(db, event)


def _mark_joiner_arrived(event: Event, participation: Participation) -> str:
    if participation.joiner_arrived_at is None:
        participation.joiner_arrived_at = datetime.utcnow()
    if event.poster_arrived_at is not None:
        _settle_participation(participation, confirmed=True)
        return "confirmed"
    return "waiting_for_organizer"


@router.post("/{event_id}/confirm/selfie", status_code=200)
def confirm_selfie(
    event_id: str,
    payload: SelfieConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = _get_event_locked_or_404(db, event_id)
    _check_window_and_geo(event, payload.lat, payload.lng)
    if payload.faces_detected < 2:
        raise HTTPException(status_code=400, detail="Для подтверждения нужно 2 лица в кадре")

    if current_user.id == event.poster_id:
        _mark_poster_arrived(db, event)
        db.commit()
        return {"status": "organizer_arrived"}

    participation = _get_own_joined_participation_locked(db, event_id, current_user.id)
    status_ = _mark_joiner_arrived(event, participation)
    db.commit()
    return {"status": status_}


@router.post("/{event_id}/confirm/qr/generate", response_model=QrGenerateOut)
def generate_qr(
    event_id: str,
    payload: QrGenerate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = _get_event_locked_or_404(db, event_id)
    if event.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="QR генерирует только постер")
    _check_window_and_geo(event, payload.lat, payload.lng)
    _mark_poster_arrived(db, event)
    db.commit()
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
    event = _get_event_locked_or_404(db, event_id)
    _check_window_and_geo(event, payload.lat, payload.lng)
    expected = _qr_tokens.get(event_id)
    if not expected or expected != payload.qr_token:
        raise HTTPException(status_code=400, detail="Неверный или истёкший QR-код")
    del _qr_tokens[event_id]

    participation = _get_own_joined_participation_locked(db, event_id, current_user.id)
    status_ = _mark_joiner_arrived(event, participation)
    db.commit()
    return {"status": status_}


@router.post("/{event_id}/resolve-no-show", status_code=200)
def resolve_no_show(
    event_id: str,
    payload: ResolveNoShow,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Грейс-период истёк, вторая сторона не отметилась — доступна компенсация."""
    event = _get_event_locked_or_404(db, event_id)
    participation = (
        db.query(Participation)
        .filter(Participation.id == payload.participation_id)
        .with_for_update()
        .first()
    )
    if not participation or participation.event_id != event_id:
        raise HTTPException(status_code=404, detail="Участие не найдено")
    if participation.status != ParticipationStatus.joined:
        raise HTTPException(status_code=400, detail="Участие уже обработано")

    grace = timedelta(minutes=settings.no_show_grace_minutes)
    now = datetime.utcnow()

    if current_user.id == participation.user_id:
        # Джойнер: он отметился, постер — нет, ждал достаточно долго.
        if participation.joiner_arrived_at is None:
            raise HTTPException(status_code=400, detail="Сначала отметьтесь как пришедший")
        if event.poster_arrived_at is not None:
            raise HTTPException(status_code=400, detail="Организатор уже подтвердил присутствие")
        if now < participation.joiner_arrived_at + grace:
            raise HTTPException(status_code=400, detail="Ещё рано — подождите грейс-период")

        _settle_participation(participation, confirmed=False, reason="poster_absent")
        # свой депозит — назад
        if participation.deposit and participation.deposit.escrow_status == EscrowStatus.released_to_poster:
            participation.deposit.escrow_status = EscrowStatus.refunded
        # депозит постера — форфейт в пользу пришедшего
        poster_deposit = event.poster_deposit
        if poster_deposit and poster_deposit.escrow_status == EscrowStatus.held:
            poster_deposit.escrow_status = EscrowStatus.forfeited
        db.commit()
        return {"status": "compensated", "reason": "poster_absent"}

    if current_user.id == event.poster_id:
        # Постер: он отметился, конкретный джойнер — нет.
        if event.poster_arrived_at is None:
            raise HTTPException(status_code=400, detail="Сначала отметьтесь как пришедший")
        if participation.joiner_arrived_at is not None:
            raise HTTPException(status_code=400, detail="Участник уже подтвердил присутствие")
        if now < event.poster_arrived_at + grace:
            raise HTTPException(status_code=400, detail="Ещё рано — подождите грейс-период")

        _settle_participation(participation, confirmed=False, reason="joiner_absent")
        db.commit()
        return {"status": "compensated", "reason": "joiner_absent"}

    raise HTTPException(status_code=403, detail="Нет доступа")


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
    if datetime.utcnow() < event.datetime_:
        raise HTTPException(status_code=400, detail="Оценка доступна только после встречи")
    if payload.rated_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя оценить самого себя")

    def _participated(user_id: str) -> bool:
        if user_id == event.poster_id:
            return True
        return (
            db.query(Participation)
            .filter(
                Participation.event_id == event_id,
                Participation.user_id == user_id,
                Participation.status == ParticipationStatus.confirmed,
            )
            .first()
            is not None
        )

    if not _participated(current_user.id):
        raise HTTPException(status_code=403, detail="Оценивать можно только встречи, в которых вы участвовали")
    if not _participated(payload.rated_id):
        raise HTTPException(status_code=400, detail="Этот пользователь не участвовал в данной встрече")

    existing = (
        db.query(Rating)
        .filter(
            Rating.event_id == event_id,
            Rating.rater_id == current_user.id,
            Rating.rated_id == payload.rated_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже оценили этого пользователя за эту встречу")

    rated_user = db.query(User).filter(User.id == payload.rated_id).first()
    if not rated_user:
        raise HTTPException(status_code=404, detail="Оцениваемый пользователь не найден")

    rating = Rating(
        event_id=event_id,
        rater_id=current_user.id,
        rated_id=payload.rated_id,
        stars=payload.stars,
        comment=payload.comment,
    )
    db.add(rating)
    db.flush()

    prior = db.query(Rating).filter(Rating.rated_id == rated_user.id).all()
    total_stars = sum(r.stars for r in prior)
    rated_user.rating_avg = round(total_stars / len(prior), 2)
    rated_user.meetings_count += 1

    db.commit()
    return {"status": "rated"}
