from fastapi import APIRouter, Depends, Query
from app.core.auth import get_current_user
from app.schemas.book import PaginatedBooks
from app.services.smart_search import hybrid_search

router = APIRouter(prefix="/api/books", tags=["smart-search"])


@router.get("/smart-search", response_model=PaginatedBooks)
def smart_search_books(
    q: str = Query("", description="Natural language search query"),
    genre: str = Query("", description="Genre filter"),
    status: str = Query("", description="Status filter"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """AI-powered smart search combining semantic and keyword search."""
    result = hybrid_search(
        query=q,
        genre=genre or None,
        status_filter=status or None,
        page=page,
        limit=limit,
    )
    return result
