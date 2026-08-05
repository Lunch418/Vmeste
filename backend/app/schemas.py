from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models import EscrowStatus, EventStatus, GenderFilter, ParticipationStatus


# --- Auth ---
class PhoneRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Users ---
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    interests: Optional[List[str]] = None


class UserOut(BaseModel):
    id: str
    name: Optional[str]
    age: Optional[int]
    city: Optional[str]
    avatar_url: Optional[str]
    rating_avg: float
    meetings_count: int
    attendance_rate: float
    interests: List[str] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, u):
        return cls(
            id=u.id,
            name=u.name,
            age=u.age,
            city=u.city,
            avatar_url=u.avatar_url,
            rating_avg=u.rating_avg,
            meetings_count=u.meetings_count,
            attendance_rate=u.attendance_rate,
            interests=[i for i in (u.interests or "").split(",") if i],
        )


class ReportCreate(BaseModel):
    event_id: Optional[str] = None
    reason: str


# --- Events ---
class EventCreate(BaseModel):
    photo_url: Optional[str] = None
    activity_type: str
    datetime_: datetime = Field(alias="datetime")
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    age_min: int = 18
    age_max: int = 99
    gender_filter: GenderFilter = GenderFilter.any
    slots_total: int = 1
    description: str = ""
    deposit_amount: int

    model_config = {"populate_by_name": True}


class EventUpdate(BaseModel):
    photo_url: Optional[str] = None
    datetime_: Optional[datetime] = Field(default=None, alias="datetime")
    location_address: Optional[str] = None
    description: Optional[str] = None

    model_config = {"populate_by_name": True}


class EventOut(BaseModel):
    id: str
    poster_id: str
    photo_url: Optional[str]
    activity_type: str
    datetime_: datetime = Field(serialization_alias="datetime")
    location_lat: Optional[float]
    location_lng: Optional[float]
    location_address: Optional[str]
    age_min: int
    age_max: int
    gender_filter: GenderFilter
    slots_total: int
    slots_taken: int
    description: str
    deposit_amount: int
    status: EventStatus
    city: str

    model_config = {"from_attributes": True}


# --- Participation / Deposits ---
class ParticipationOut(BaseModel):
    id: str
    event_id: str
    user_id: str
    status: ParticipationStatus
    deposit_id: Optional[str]

    model_config = {"from_attributes": True}


class DepositCreate(BaseModel):
    participation_id: str


class DepositOut(BaseModel):
    id: str
    participation_id: Optional[str]
    payer_id: str
    amount: int
    escrow_status: EscrowStatus
    yukassa_payment_id: Optional[str]

    model_config = {"from_attributes": True}


# --- Chat ---
class MessageCreate(BaseModel):
    text: str


class MessageOut(BaseModel):
    id: str
    event_id: str
    sender_id: str
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Meeting confirmation ---
class SelfieConfirm(BaseModel):
    faces_detected: int
    filter_name: Optional[str] = None


class QrGenerateOut(BaseModel):
    qr_token: str


class QrScan(BaseModel):
    qr_token: str


class RatingCreate(BaseModel):
    rated_id: str
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = None
