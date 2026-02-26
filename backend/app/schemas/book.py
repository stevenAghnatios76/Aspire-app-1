from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    author: str = Field(..., min_length=1, max_length=500)
    isbn: Optional[str] = Field(None, max_length=20)
    genre: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    cover_url: Optional[str] = None
    published_year: Optional[int] = Field(None, ge=1000, le=2100)
    total_copies: int = Field(1, ge=1)
    available_copies: int = Field(1, ge=0)


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    author: Optional[str] = Field(None, min_length=1, max_length=500)
    isbn: Optional[str] = Field(None, max_length=20)
    genre: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    cover_url: Optional[str] = None
    published_year: Optional[int] = Field(None, ge=1000, le=2100)
    total_copies: Optional[int] = Field(None, ge=1)
    available_copies: Optional[int] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(available|checked_out|unavailable)$")


class BookResponse(BookBase):
    id: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedBooks(BaseModel):
    data: list[BookResponse]
    total: int
    page: int
    limit: int
    total_pages: int
