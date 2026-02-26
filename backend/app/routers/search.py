from fastapi import APIRouter, Depends, Query
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin
from app.schemas.book import PaginatedBooks
import math

router = APIRouter(prefix="/api/books", tags=["search"])


@router.get("/search", response_model=PaginatedBooks)
async def search_books(
    q: str = Query("", description="Search query across title, author, genre, ISBN"),
    genre: str = Query("", description="Filter by genre"),
    status: str = Query("", description="Filter by status: available, checked_out, unavailable"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Search books by title, author, genre, ISBN with optional filters.
    """
    supabase = get_supabase_admin()
    offset = (page - 1) * limit

    # Build base query for count
    count_query = supabase.table("books").select("id", count="exact")
    data_query = supabase.table("books").select("*")

    # Apply search filter (ILIKE across multiple columns)
    if q:
        search_filter = (
            f"title.ilike.%{q}%,"
            f"author.ilike.%{q}%,"
            f"genre.ilike.%{q}%,"
            f"isbn.ilike.%{q}%"
        )
        count_query = count_query.or_(search_filter)
        data_query = data_query.or_(search_filter)

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
