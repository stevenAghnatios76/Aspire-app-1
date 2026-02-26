from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    frontend_url: str = "http://localhost:3000"  # comma-separated for multiple origins
    google_api_key: str = ""  # Google Gemini API key — used for embeddings + Google Books API
    resend_api_key: str | None = None  # Optional — email notifications

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
