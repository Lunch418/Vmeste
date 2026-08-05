from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Block, Report, User
from app.schemas import ReportCreate, UserOut, UserProfileUpdate
from app.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.from_model(current_user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "interests" in data and data["interests"] is not None:
        data["interests"] = ",".join(data["interests"])
    for field, value in data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserOut.from_model(current_user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return UserOut.from_model(user)


@router.post("/{user_id}/report", status_code=204)
def report_user(
    user_id: str,
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = Report(
        reporter_id=current_user.id,
        reported_id=user_id,
        event_id=payload.event_id,
        reason=payload.reason,
    )
    db.add(report)
    db.commit()
    return None


@router.post("/{user_id}/block", status_code=204)
def block_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    existing = (
        db.query(Block)
        .filter(Block.blocker_id == current_user.id, Block.blocked_id == user_id)
        .first()
    )
    if not existing:
        db.add(Block(blocker_id=current_user.id, blocked_id=user_id))
        db.commit()
    return None
