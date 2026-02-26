import logging
import warnings
from datetime import datetime, timezone
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import get_settings
from app.core.supabase import get_supabase_admin
from fastapi import HTTPException, status

warnings.filterwarnings("ignore", message="Pydantic serializer warnings")

logger = logging.getLogger(__name__)

_llm = None


def _get_llm() -> ChatGoogleGenerativeAI:
    """Lazy-initialize the Gemini LLM."""
    global _llm
    if _llm is None:
        settings = get_settings()
        _llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.google_api_key,
        )
    return _llm


def generate_book_summary(book: dict) -> str:
    """Generate a 3-4 sentence AI summary for a book."""
    title = book.get("title", "Unknown")
    author = book.get("author", "Unknown")
    genre = book.get("genre", "")
    description = book.get("description", "")

    prompt = (
        f"Write a concise 3-4 sentence summary of the book \"{title}\" by {author}."
    )
    if genre:
        prompt += f" Genre: {genre}."
    if description:
        prompt += f" Description: {description}"
    prompt += "\n\nProvide an engaging summary that would help a reader decide whether to borrow this book. Do not include any prefixes like 'Summary:' — just the summary text."

    try:
        llm = _get_llm()
        response = llm.invoke(prompt)
        # Convert response content to string to avoid Pydantic serialization warnings
        return str(response.content).strip()
    except Exception as exc:
        logger.error("LLM summary generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI summary service is temporarily unavailable. Please try again later.",
        )


def get_or_generate_summary(book_id: str) -> dict:
    """Check cache first, generate if missing, store in DB."""
    supabase = get_supabase_admin()

    # Check cache
    cache_result = (
        supabase.table("book_summaries")
        .select("*")
        .eq("book_id", book_id)
        .maybe_single()
        .execute()
    )

    if cache_result and cache_result.data:
        return {
            "book_id": book_id,
            "summary": cache_result.data["summary"],
            "generated_at": cache_result.data["generated_at"],
            "cached": True,
        }

    # Fetch book details
    book_result = (
        supabase.table("books")
        .select("title, author, genre, description")
        .eq("id", book_id)
        .single()
        .execute()
    )
    if not book_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Generate summary
    summary = generate_book_summary(book_result.data)
    now = datetime.now(timezone.utc).isoformat()

    # Store in cache
    supabase.table("book_summaries").insert({
        "book_id": book_id,
        "summary": summary,
        "generated_at": now,
    }).execute()

    return {
        "book_id": book_id,
        "summary": summary,
        "generated_at": now,
        "cached": False,
    }
