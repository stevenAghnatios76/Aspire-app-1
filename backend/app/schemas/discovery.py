from pydantic import BaseModel, Field
from typing import Optional


class DiscoveryRequest(BaseModel):
    paragraph: str = Field(..., min_length=20, max_length=2000)


class DiscoveredBook(BaseModel):
    title: str
    author: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    source_url: Optional[str] = None
    isbn: Optional[str] = None
    relevance_reason: Optional[str] = None
    in_catalog: bool = False
    catalog_book_id: Optional[str] = None
    available_copies: Optional[int] = None


class DiscoveryResponse(BaseModel):
    books: list[DiscoveredBook]
    intent: dict = {}
    total: int
