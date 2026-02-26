import logging
import math
from app.core.supabase import get_supabase_admin
from app.services.embeddings import generate_embedding

logger = logging.getLogger(__name__)


def semantic_search(query: str, limit: int = 20) -> list[dict]:
    """Perform semantic search using pgvector embeddings."""
    try:
        embedding = generate_embedding(query)
    except Exception as exc:
        logger.error("Embedding generation failed for search: %s", exc)
        return []

    supabase = get_supabase_admin()
    try:
        result = supabase.rpc(
            "find_similar_books_for_search",
            {
                "query_embedding": str(embedding),
                "result_limit": limit,
            },
        ).execute()
        return result.data or []
    except Exception as exc:
        logger.error("RPC find_similar_books_for_search failed: %s", exc)
        return []


def keyword_search(query: str, genre: str | None, status_filter: str | None, page: int, limit: int) -> dict:
    """Standard ILIKE keyword search (fallback)."""
    supabase = get_supabase_admin()
    offset = (page - 1) * limit

    # Build count query
    count_q = supabase.table("books").select("id", count="exact")
    data_q = supabase.table("books").select("*")

    if query:
        ilike_pattern = f"%{query}%"
        count_q = count_q.or_(
            f"title.ilike.{ilike_pattern},author.ilike.{ilike_pattern},genre.ilike.{ilike_pattern},isbn.ilike.{ilike_pattern},description.ilike.{ilike_pattern}"
        )
        data_q = data_q.or_(
            f"title.ilike.{ilike_pattern},author.ilike.{ilike_pattern},genre.ilike.{ilike_pattern},isbn.ilike.{ilike_pattern},description.ilike.{ilike_pattern}"
        )

    if genre:
        count_q = count_q.eq("genre", genre)
        data_q = data_q.eq("genre", genre)

    if status_filter:
        count_q = count_q.eq("status", status_filter)
        data_q = data_q.eq("status", status_filter)

    count_result = count_q.execute()
    total = count_result.count or 0

    data_result = (
        data_q.order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {
        "data": data_result.data or [],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
    }


def hybrid_search(query: str, genre: str | None, status_filter: str | None, page: int, limit: int) -> dict:
    """Combine semantic + keyword search with dedup and filtering."""
    # Short queries → keyword only for speed
    if not query or len(query.split()) < 3:
        return keyword_search(query, genre, status_filter, page, limit)

    # Get semantic results
    semantic_results = semantic_search(query, limit=40)

    # Get keyword results
    kw_result = keyword_search(query, genre, status_filter, page=1, limit=40)
    keyword_results = kw_result["data"]

    # Merge and deduplicate
    seen_ids: set[str] = set()
    merged: list[dict] = []

    # Semantic results first (they have relevance scores)
    for book in semantic_results:
        book_id = book["id"]
        if book_id in seen_ids:
            continue

        # Apply filters
        if genre and book.get("genre") != genre:
            continue
        if status_filter and book.get("status") != status_filter:
            continue

        seen_ids.add(book_id)
        merged.append(book)

    # Add keyword results not already in semantic results
    for book in keyword_results:
        book_id = book["id"]
        if book_id in seen_ids:
            continue
        seen_ids.add(book_id)
        merged.append(book)

    # Paginate the merged results
    total = len(merged)
    offset = (page - 1) * limit
    page_data = merged[offset:offset + limit]

    return {
        "data": page_data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
    }
