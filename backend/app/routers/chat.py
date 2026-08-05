from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Message, Participation, User
from app.schemas import MessageCreate, MessageOut
from app.security import decode_token, get_current_user
from app.ws_manager import manager

router = APIRouter(tags=["chat"])


def _assert_participant(db: Session, event_id: str, user_id: str, poster_id: str):
    if user_id == poster_id:
        return
    participation = (
        db.query(Participation)
        .filter(Participation.event_id == event_id, Participation.user_id == user_id)
        .first()
    )
    if not participation:
        raise HTTPException(status_code=403, detail="Доступен только участникам события")


@router.get("/events/{event_id}/messages", response_model=List[MessageOut])
def get_messages(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import Event

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    _assert_participant(db, event_id, current_user.id, event.poster_id)
    return (
        db.query(Message)
        .filter(Message.event_id == event_id)
        .order_by(Message.created_at.asc())
        .all()
    )


@router.post("/events/{event_id}/messages", response_model=MessageOut, status_code=201)
def post_message(
    event_id: str,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import Event

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    _assert_participant(db, event_id, current_user.id, event.poster_id)

    message = Message(event_id=event_id, sender_id=current_user.id, text=payload.text)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.websocket("/ws/events/{event_id}/chat")
async def chat_ws(websocket: WebSocket, event_id: str, token: str = Query(...)):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        from app.models import Event

        auth_user = db.query(User).filter(User.id == user_id).first()
        if not auth_user or auth_user.is_banned:
            await websocket.close(code=4401)
            return

        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            await websocket.close(code=4404)
            return
        try:
            _assert_participant(db, event_id, user_id, event.poster_id)
        except HTTPException:
            await websocket.close(code=4403)
            return

        await manager.connect(event_id, websocket)
        try:
            while True:
                data = await websocket.receive_json()
                text = str(data.get("text", "")).strip()[:2000]
                if not text:
                    continue
                message = Message(event_id=event_id, sender_id=user_id, text=text)
                db.add(message)
                db.commit()
                db.refresh(message)
                await manager.broadcast(
                    event_id,
                    {
                        "id": message.id,
                        "event_id": event_id,
                        "sender_id": user_id,
                        "text": text,
                        "created_at": message.created_at.isoformat(),
                    },
                )
        except WebSocketDisconnect:
            manager.disconnect(event_id, websocket)
    finally:
        db.close()
