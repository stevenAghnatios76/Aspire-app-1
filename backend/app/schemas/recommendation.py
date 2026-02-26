from pydantic import BaseModel
from typing import Optional


class SimilarBook(BaseModel):
    id: str
    title: str
    author: str
    cover_url: Optional[str] = None
    similarity: float  # 0-1 cosine similarity


class BookRecommendation(BaseModel):
    id: str
    title: str
    author: str
    genre: Optional[str] = None
    cover_url: Optional[str] = None
    similarity: float  # percentage 0-100


class RecommendationResponse(BaseModel):
    books: list[BookRecommendation]
    message: Optional[str] = None
