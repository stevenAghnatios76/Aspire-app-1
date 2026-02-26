import json
import logging
import numpy as np
from app.core.supabase import get_supabase_admin

logger = logging.getLogger(__name__)


def get_reader_recommendations(user_id: str) -> dict:
    """
    Generate personalized book recommendations for a reader based on their
    borrow history using pgvector cosine similarity.

    Returns a dict with 'books' (list of recommendations) and 'message' (optional).
    """
    supabase = get_supabase_admin()

    # 1. Fetch the reader's borrow history (all statuses)
    borrow_result = (
        supabase.table("borrow_records")
        .select("book_id")
        .eq("user_id", user_id)
        .execute()
    )
    borrow_records = borrow_result.data or []

    if not borrow_records:
        return {
            "books": [],
            "message": "No borrow history to base recommendations on.",
        }

    book_ids = list({r["book_id"] for r in borrow_records})

    # 2. Get embeddings for borrowed books
    books_result = (
        supabase.table("books")
        .select("id, embedding")
        .in_("id", book_ids)
        .execute()
    )
    borrowed_books = books_result.data or []

    # Filter to books that actually have embeddings and parse string representations
    raw_embeddings = [
        b["embedding"]
        for b in borrowed_books
        if b.get("embedding") is not None
    ]

    if not raw_embeddings:
        return {
            "books": [],
            "message": "No embeddings available for borrowed books. Please generate embeddings first.",
        }

    # Supabase REST API returns pgvector values as strings — parse them
    parsed = [
        json.loads(e) if isinstance(e, str) else e
        for e in raw_embeddings
    ]

    # 3. Compute average embedding (taste profile)
    embedding_array = np.array(parsed, dtype=np.float64)
    taste_profile = np.mean(embedding_array, axis=0).tolist()

    # 4. Call the pgvector RPC function for cosine similarity search
    try:
        rpc_result = supabase.rpc(
            "recommend_books_for_reader",
            {
                "taste_vector": str(taste_profile),
                "reader_id": user_id,
                "result_limit": 5,
            },
        ).execute()
    except Exception as exc:
        logger.error("RPC recommend_books_for_reader failed: %s", exc)
        return {
            "books": [],
            "message": "Failed to run recommendation query. Ensure the RPC function is deployed.",
        }

    recommendations = rpc_result.data or []

    if not recommendations:
        return {
            "books": [],
            "message": "No recommendations found. The reader may have borrowed all available books.",
        }

    # 5. Convert similarity scores to percentages
    books = [
        {
            "id": rec["id"],
            "title": rec["title"],
            "author": rec["author"],
            "genre": rec.get("genre"),
            "cover_url": rec.get("cover_url"),
            "similarity": round((rec["similarity"] or 0) * 100, 1),
        }
        for rec in recommendations
    ]

    return {"books": books, "message": None}
