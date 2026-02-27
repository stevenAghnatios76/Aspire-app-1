from fastapi import APIRouter, Depends, Query
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin
from app.schemas.book import PaginatedBooks
import math

router = APIRouter(prefix="/api/books", tags=["search"])


@router.get("/search", response_model=PaginatedBooks)
def search_books(
    q: str = Query("", description="Search query across title, author, genre, ISBN"),
    genre: str = Query("", description="Filter by genre"),
    status: str = Query("", description="Filter by status: available, checked_out, unavailable"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Search books by title, author, genre, ISBN with optional filters.
    Uses PostgreSQL full-text search (GIN indexes) for title/author,
    and falls back to ILIKE for genre/ISBN.
    """
    supabase = get_supabase_admin()
    offset = (page - 1) * limit

    # Build base queries
    count_query = supabase.table("books").select("id", count="exact")
    data_query = supabase.table("books").select("*")

    # Apply search filter — use full-text search for title+author (GIN indexed),
    # keep ILIKE for genre/ISBN (B-tree indexed)
    if q:
        # Convert search query to tsquery format: "word1 & word2" for multi-word
        ts_terms = " & ".join(q.strip().split())
        fts_filter = (
            f"title.fts.{ts_terms},"
            f"author.fts.{ts_terms},"
            f"genre.ilike.%{q}%,"
            f"isbn.ilike.%{q}%"
        )
        count_query = count_query.or_(fts_filter)
        data_query = data_query.or_(fts_filter)

    # Apply genre filter
    if genre:
        count_query = count_query.eq("genre", genre)
        data_query = data_query.eq("genre", genre)

    # Apply status filter
    if status:
        count_query = count_query.eq("status", status)
        data_query = data_query.eq("status", status)

    # Execute count
    count_result = count_query.execute()
    total = count_result.count or 0

    # Execute paginated data query
    result = (
        data_query
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return PaginatedBooks(
        data=result.data,
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if total > 0 else 1,
    )
