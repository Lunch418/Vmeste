from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.models import EscrowStatus, EventStatus, GenderFilter, ParticipationStatus

# Международный формат номера: опциональный "+", 10-15 цифр
PHONE_PATTERN = r"^\+?\d{10,15}$"
CODE_PATTERN = r"^\d{4}$"


# --- Auth ---
class PhoneRequest(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)


class VerifyRequest(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)
    code: str = Field(pattern=CODE_PATTERN)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Users ---
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Literal["male", "female"]] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    interests: Optional[List[str]] = None


class UserOut(BaseModel):
    id: str
    name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
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
            gender=u.gender,
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
    age_min: int = Field(default=18, ge=0, le=120)
    age_max: int = Field(default=99, ge=0, le=120)
    gender_filter: GenderFilter = GenderFilter.any
    slots_total: int = Field(default=1, ge=1)
    description: str = ""
    deposit_amount: int = Field(ge=0)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def check_age_range(self):
        if self.age_min > self.age_max:
            raise ValueError("age_min не может быть больше age_max")
        return self


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
