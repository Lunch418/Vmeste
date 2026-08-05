from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    Block,
    Event,
    EventStatus,
    GenderFilter,
    Participation,
    ParticipationStatus,
    User,
)
from app.schemas import EventCreate, EventOut, EventUpdate, ParticipationOut
from app.security import get_current_user

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=List[EventOut])
def list_events(
    type: Optional[str] = None,
    date: Optional[date] = None,
    deposit_min: Optional[int] = None,
    deposit_max: Optional[int] = None,
    city: str = settings.allowed_city,
    db: Session = Depends(get_db),
):
    q = db.query(Event).filter(Event.status == EventStatus.active, Event.city == city)
    if type:
        q = q.filter(Event.activity_type == type)
    if date:
        q = q.filter(Event.datetime_.between(datetime.combine(date, datetime.min.time()), datetime.combine(date, datetime.max.time())))
    if deposit_min is not None:
        q = q.filter(Event.deposit_amount >= deposit_min)
    if deposit_max is not None:
        q = q.filter(Event.deposit_amount <= deposit_max)
    return q.order_by(Event.datetime_.asc()).all()


@router.post("", response_model=EventOut, status_code=201)
def create_event(
    payload: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = Event(
        poster_id=current_user.id,
        photo_url=payload.photo_url,
        activity_type=payload.activity_type,
        datetime_=payload.datetime_,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        location_address=payload.location_address,
        age_min=payload.age_min,
        age_max=payload.age_max,
        gender_filter=payload.gender_filter,
        slots_total=payload.slots_total,
        description=payload.description,
        deposit_amount=payload.deposit_amount,
        city=current_user.city or settings.allowed_city,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    return event


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if event.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Редактировать может только автор")
    for field, value in payload.model_dump(exclude_unset=True, by_alias=False).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def cancel_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    if event.poster_id != current_user.id:
        raise HTTPException(status_code=403, detail="Отменить может только автор")
    event.status = EventStatus.cancelled
    db.commit()
    return None


@router.post("/{event_id}/join", response_model=ParticipationOut, status_code=201)
def join_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or event.status != EventStatus.active:
        raise HTTPException(status_code=404, detail="Событие не найдено или неактивно")
    if event.poster_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя присоединиться к своему событию")
    if event.slots_taken >= event.slots_total:
        raise HTTPException(status_code=400, detail="Свободных мест нет")

    if current_user.age is not None and not (event.age_min <= current_user.age <= event.age_max):
        raise HTTPException(
            status_code=403,
            detail=f"Событие для возраста {event.age_min}–{event.age_max}",
        )
    if (
        event.gender_filter != GenderFilter.any
        and current_user.gender is not None
        and current_user.gender != event.gender_filter.value
    ):
        raise HTTPException(status_code=403, detail="Событие ограничено по полу участников")

    blocked = (
        db.query(Block)
        .filter(
            (
                (Block.blocker_id == current_user.id) & (Block.blocked_id == event.poster_id)
            )
            | (
                (Block.blocker_id == event.poster_id) & (Block.blocked_id == current_user.id)
            )
        )
        .first()
    )
    if blocked:
        raise HTTPException(status_code=403, detail="Присоединение недоступно")

    existing = (
        db.query(Participation)
        .filter(Participation.event_id == event_id, Participation.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже участвуете в этом событии")

    participation = Participation(event_id=event_id, user_id=current_user.id)
    event.slots_taken += 1
    db.add(participation)
    db.commit()
    db.refresh(participation)
    return participation


@router.post("/{event_id}/leave", status_code=204)
def leave_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participation = (
        db.query(Participation)
        .filter(Participation.event_id == event_id, Participation.user_id == current_user.id)
        .first()
    )
    if not participation:
        raise HTTPException(status_code=404, detail="Участие не найдено")
    if participation.status == ParticipationStatus.cancelled:
        raise HTTPException(status_code=400, detail="Участие уже отменено")
    event = db.query(Event).filter(Event.id == event_id).first()
    participation.status = ParticipationStatus.cancelled
    if event and event.slots_taken > 0:
        event.slots_taken -= 1
    db.commit()
    return None
