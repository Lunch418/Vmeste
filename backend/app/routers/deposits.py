from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import payments
from app.database import get_db
from app.models import (
    Deposit,
    EscrowStatus,
    Participation,
    ParticipationStatus,
    User,
)
from app.schemas import DepositCreate, DepositOut
from app.security import get_current_user

router = APIRouter(prefix="/deposits", tags=["deposits"])


@router.post("", response_model=DepositOut, status_code=201)
def create_deposit(
    payload: DepositCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participation = (
        db.query(Participation).filter(Participation.id == payload.participation_id).first()
    )
    if not participation:
        raise HTTPException(status_code=404, detail="Участие не найдено")
    if participation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Не ваше участие")
    if participation.deposit_id:
        raise HTTPException(status_code=400, detail="Депозит уже создан")

    event = participation.event
    yk_payment_id = payments.create_payment(
        event.deposit_amount, f"Депозит за участие в «{event.activity_type}»"
    )
    deposit = Deposit(
        participation_id=participation.id,
        payer_id=current_user.id,
        amount=event.deposit_amount,
        yukassa_payment_id=yk_payment_id,
        escrow_status=EscrowStatus.held,
    )
    db.add(deposit)
    db.flush()
    participation.deposit_id = deposit.id
    db.commit()
    db.refresh(deposit)
    return deposit


@router.post("/{deposit_id}/webhook", status_code=204)
def yukassa_webhook(deposit_id: str, db: Session = Depends(get_db)):
    """Коллбек от ЮKassa о подтверждении платежа.

    ЗАГЛУШКА: нет проверки подписи провайдера (нет merchant-аккаунта — см.
    specs/CHANGES.md). Эндпоинт остаётся без аутентификации, т.к. реальные
    платёжные вебхуки вызываются самим провайдером, а не пользователем —
    но именно поэтому он НЕ должен уметь откатывать уже расчитанный эскроу
    обратно в held: без этой защиты кто угодно, зная deposit_id, мог
    вернуть settled-депозит в held и запросить повторный refund/расчёт.
    """
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Депозит не найден")
    if deposit.escrow_status != EscrowStatus.held:
        # Депозит уже расчитан (refunded/released/forfeited) — подтверждение
        # оплаты для уже закрытого эскроу ничего не меняет.
        return None
    deposit.escrow_status = EscrowStatus.held
    db.commit()
    return None


@router.post("/{deposit_id}/refund", response_model=DepositOut)
def refund_deposit(
    deposit_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Депозит не найден")
    if deposit.payer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Не ваш депозит")
    if deposit.escrow_status != EscrowStatus.held:
        raise HTTPException(status_code=400, detail="Депозит уже обработан")

    payments.refund_payment(deposit.yukassa_payment_id)
    deposit.escrow_status = EscrowStatus.refunded
    if deposit.participation:
        deposit.participation.status = ParticipationStatus.cancelled
    db.commit()
    db.refresh(deposit)
    return deposit


@router.get("/{deposit_id}", response_model=DepositOut)
def get_deposit(
    deposit_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        raise HTTPException(status_code=404, detail="Депозит не найден")

    is_payer = deposit.payer_id == current_user.id
    is_poster = bool(
        deposit.participation and deposit.participation.event.poster_id == current_user.id
    )
    if not is_payer and not is_poster:
        raise HTTPException(status_code=403, detail="Нет доступа к этому депозиту")
    return deposit
