from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./vmeste.db"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30
    allowed_city: str = "Пермь"
    meeting_confirm_window_minutes: int = 120

    class Config:
        env_file = ".env"


settings = Settings()
