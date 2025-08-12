from fastapi import Depends, Header
from .config import settings

def get_use_mocks() -> bool:
    return settings.USE_MOCKS

def get_user(x_mock_user: str | None = Header(default=None)) -> dict | None:
    # Mock user via header; otherwise None
    if settings.USE_MOCKS and x_mock_user:
        return {"id": "u1", "email": x_mock_user, "role": "admin" if "admin" in x_mock_user else "member"}
    return None
