import logging
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import get_settings
from app.core.supabase import get_supabase_admin

logger = logging.getLogger(__name__)

_embeddings_model = None


def _get_embeddings_model() -> GoogleGenerativeAIEmbeddings:
    """Lazy-initialize the Google Gemini embeddings model."""
    global _embeddings_model
    if _embeddings_model is None:
        settings = get_settings()
        _embeddings_model = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=settings.google_api_key,
        )
    return _embeddings_model


def get_embedding_text(book: dict) -> str:
    """Build the text to embed from a book's metadata."""
    description = book.get("description") or ""
    if description.strip():
        return description.strip()
    # Fallback: combine title + author + genre
    parts = [book.get("title", ""), book.get("author", "")]
    genre = book.get("genre")
    if genre:
        parts.append(genre)
    return " ".join(parts)


def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dimensional embedding vector for the given text using Google Gemini."""
    model = _get_embeddings_model()
    return model.embed_query(text, output_dimensionality=768)


def generate_and_store_embedding(book_id: str, text: str) -> None:
    """Generate an embedding for the given text and store it in the books table."""
    embedding = generate_embedding(text)
    supabase = get_supabase_admin()
    supabase.table("books").update({"embedding": embedding}).eq("id", book_id).execute()
    logger.info("Stored embedding for book %s", book_id)


def batch_generate_embeddings() -> int:
    """
    Generate embeddings for all books that don't have one yet.
    Returns the count of books processed.
    """
    supabase = get_supabase_admin()
    # Fetch all books without embeddings
    result = (
        supabase.table("books")
        .select("id, title, author, genre, description")
        .is_("embedding", "null")
        .execute()
    )
    books = result.data or []
    if not books:
        return 0

    count = 0
    for book in books:
        try:
            text = get_embedding_text(book)
            generate_and_store_embedding(book["id"], text)
            count += 1
        except Exception as exc:
            logger.error("Failed to generate embedding for book %s: %s", book["id"], exc)

    return count
