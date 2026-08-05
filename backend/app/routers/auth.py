from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import sms
from app.database import get_db
from app.models import User
from app.schemas import PhoneRequest, TokenResponse, VerifyRequest
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/phone", status_code=204)
def request_code(payload: PhoneRequest):
    try:
        sms.generate_and_send_code(payload.phone)
    except sms.RateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    return None


@router.post("/verify", response_model=TokenResponse)
def verify_code(payload: VerifyRequest, db: Session = Depends(get_db)):
    if not sms.verify_code(payload.phone, payload.code):
        raise HTTPException(status_code=400, detail="Неверный или истёкший код")

    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        user = User(phone=payload.phone)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)
