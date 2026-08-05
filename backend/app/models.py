import enum
import uuid
from datetime import datetime, timedelta

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class EventStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    cancelled = "cancelled"


class ParticipationStatus(str, enum.Enum):
    joined = "joined"
    confirmed = "confirmed"
    no_show = "no_show"
    cancelled = "cancelled"


class EscrowStatus(str, enum.Enum):
    held = "held"
    released_to_payer = "released_to_payer"
    released_to_poster = "released_to_poster"
    refunded = "refunded"


class GenderFilter(str, enum.Enum):
    any = "any"
    male = "male"
    female = "female"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)  # "male" | "female" | None
    city = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    rating_avg = Column(Float, default=0.0)
    meetings_count = Column(Integer, default=0)
    attendance_rate = Column(Float, default=1.0)
    interests = Column(String, default="")  # comma-separated for MVP simplicity
    is_banned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    events = relationship("Event", back_populates="poster")


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=gen_uuid)
    poster_id = Column(String, ForeignKey("users.id"), nullable=False)
    photo_url = Column(String, nullable=True)
    activity_type = Column(String, nullable=False)
    datetime_ = Column("datetime", DateTime, nullable=False)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    location_address = Column(String, nullable=True)
    age_min = Column(Integer, default=18)
    age_max = Column(Integer, default=99)
    gender_filter = Column(Enum(GenderFilter), default=GenderFilter.any)
    slots_total = Column(Integer, nullable=False, default=1)
    slots_taken = Column(Integer, nullable=False, default=0)
    description = Column(Text, default="")
    deposit_amount = Column(Integer, nullable=False)  # kopecks
    status = Column(Enum(EventStatus), default=EventStatus.active)
    city = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    poster = relationship("User", back_populates="events")
    participations = relationship("Participation", back_populates="event")
    messages = relationship("Message", back_populates="event")

    @property
    def auto_archive_at(self) -> datetime:
        return self.datetime_ + timedelta(hours=2)


class Participation(Base):
    __tablename__ = "participations"

    id = Column(String, primary_key=True, default=gen_uuid)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ParticipationStatus), default=ParticipationStatus.joined)
    deposit_id = Column(String, ForeignKey("deposits.id"), nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="participations")
    deposit = relationship(
        "Deposit",
        back_populates="participation",
        uselist=False,
        foreign_keys="Deposit.participation_id",
    )


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(String, primary_key=True, default=gen_uuid)
    participation_id = Column(String, ForeignKey("participations.id"), nullable=True)
    payer_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)  # kopecks
    escrow_status = Column(Enum(EscrowStatus), default=EscrowStatus.held)
    yukassa_payment_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    participation = relationship(
        "Participation",
        back_populates="deposit",
        foreign_keys=[participation_id],
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="messages")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(String, primary_key=True, default=gen_uuid)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    rater_id = Column(String, ForeignKey("users.id"), nullable=False)
    rated_id = Column(String, ForeignKey("users.id"), nullable=False)
    stars = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=gen_uuid)
    reporter_id = Column(String, ForeignKey("users.id"), nullable=False)
    reported_id = Column(String, ForeignKey("users.id"), nullable=False)
    event_id = Column(String, ForeignKey("events.id"), nullable=True)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Block(Base):
    __tablename__ = "blocks"

    id = Column(String, primary_key=True, default=gen_uuid)
    blocker_id = Column(String, ForeignKey("users.id"), nullable=False)
    blocked_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
