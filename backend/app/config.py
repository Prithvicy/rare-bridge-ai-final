import os
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    # dotenv is optional; ignore if not available
    pass

class Settings:
    USE_MOCKS: bool = os.getenv("USE_MOCKS", "true").lower() == "true"
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    PERPLEXITY_API_KEY: str | None = os.getenv("PERPLEXITY_API_KEY")
    SUPABASE_URL: str | None = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    DATABASE_URL: str | None = os.getenv("DATABASE_URL")
    API_PREFIX: str = ""
    CORS_ORIGINS = [os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")]
    # Email provider (Resend)
    RESEND_API_KEY: str | None = os.getenv("RESEND_API_KEY")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "Rare Bridge AI <onboarding@resend.dev>")

settings = Settings()
