from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BookRequestCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    author: Optional[str] = Field(None, max_length=500)
    isbn: Optional[str] = Field(None, max_length=20)
    cover_url: Optional[str] = None
    source_url: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None


class BookRequestOut(BaseModel):
    id: str
    user_id: str
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    source_url: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    status: str
    librarian_note: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None

    class Config:
        from_attributes = True


class BookRequestReview(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    note: Optional[str] = None
