from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class UserSetupInput(BaseModel):
    role: str = Field(..., pattern="^(reader|librarian)$")


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
