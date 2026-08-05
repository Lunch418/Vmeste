from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./vmeste.db"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-in-production"
    cors_allowed_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30
    allowed_city: str = "Пермь"
    meeting_confirm_window_minutes: int = 120
    no_show_grace_minutes: int = 15
    arrival_radius_meters: float = 150.0

    class Config:
        env_file = ".env"


settings = Settings()
