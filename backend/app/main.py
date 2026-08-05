import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.archive import auto_archive_loop
from app.database import Base, engine
from app.routers import auth, chat, confirm, deposits, events, notifications, users

logging.getLogger("sms").setLevel(logging.INFO)
logging.getLogger("sms").addHandler(logging.StreamHandler())


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    task = asyncio.create_task(auto_archive_loop())
    yield
    task.cancel()


app = FastAPI(title="Вместе API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(events.router)
app.include_router(deposits.router)
app.include_router(chat.router)
app.include_router(confirm.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok"}
