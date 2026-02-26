import logging
import json
import warnings
import httpx
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import get_settings
from app.core.supabase import get_supabase_admin
from fastapi import HTTPException, status

warnings.filterwarnings("ignore", message="Pydantic serializer warnings")

logger = logging.getLogger(__name__)

_llm = None


def _get_llm() -> ChatGoogleGenerativeAI:
    global _llm
    if _llm is None:
        settings = get_settings()
        _llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.google_api_key,
        )
    return _llm


def extract_search_intent(paragraph: str) -> dict:
    """Use Gemini to extract search themes, genres, moods, and queries from a paragraph."""
    prompt = (
        "Analyze the following paragraph describing what kind of books a reader is looking for. "
        "Extract the key information and return a JSON object with these fields:\n"
        "- themes: list of key themes or topics\n"
        "- genres: list of relevant book genres\n"
        "- mood: the overall mood or tone desired\n"
        "- search_queries: 3-5 specific search queries to find matching books on Google Books\n\n"
        f"Paragraph: {paragraph}\n\n"
        "Return ONLY valid JSON, no markdown formatting."
    )

    try:
        llm = _get_llm()
        response = llm.invoke(prompt)
        # Convert response content to string to avoid Pydantic serialization warnings
        text = str(response.content).strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)
    except Exception as exc:
        logger.error("Intent extraction failed: %s", exc)
        # Fallback: use the paragraph directly as a search query
        words = paragraph.split()[:10]
        return {
            "themes": [],
            "genres": [],
            "mood": "",
            "search_queries": [" ".join(words)],
        }


def _search_google_books(query: str, max_results: int, api_key: str) -> list[dict]:
    """Search Google Books API for a single query. Returns list of book dicts."""
    resp = httpx.get(
        "https://www.googleapis.com/books/v1/volumes",
        params={"q": query, "maxResults": max_results, "key": api_key},
        timeout=10.0,
    )
    resp.raise_for_status()
    data = resp.json()
    books = []
    for item in data.get("items", []):
        info = item.get("volumeInfo", {})
        title = info.get("title", "")
        authors = info.get("authors", [])
        image_links = info.get("imageLinks", {})
        isbn = None
        for identifier in info.get("industryIdentifiers", []):
            if identifier.get("type") in ("ISBN_13", "ISBN_10"):
                isbn = identifier.get("identifier")
                break
        books.append({
            "title": title,
            "author": authors[0] if authors else "Unknown",
            "description": info.get("description", ""),
            "cover_url": image_links.get("thumbnail") or image_links.get("smallThumbnail"),
            "source_url": info.get("infoLink"),
            "isbn": isbn,
        })
    return books


def _search_open_library(query: str, max_results: int) -> list[dict]:
    """Search Open Library API for a single query (no API key needed)."""
    resp = httpx.get(
        "https://openlibrary.org/search.json",
        params={"q": query, "limit": max_results, "fields": "title,author_name,isbn,cover_i,key,first_sentence"},
        timeout=10.0,
    )
    resp.raise_for_status()
    data = resp.json()
    books = []
    for doc in data.get("docs", []):
        title = doc.get("title", "")
        authors = doc.get("author_name", [])
        cover_id = doc.get("cover_i")
        cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None
        isbns = doc.get("isbn", [])
        isbn = isbns[0] if isbns else None
        ol_key = doc.get("key", "")
        source_url = f"https://openlibrary.org{ol_key}" if ol_key else None
        first_sentence = doc.get("first_sentence", [])
        description = first_sentence[0] if first_sentence else ""
        books.append({
            "title": title,
            "author": authors[0] if authors else "Unknown",
            "description": description,
            "cover_url": cover_url,
            "source_url": source_url,
            "isbn": isbn,
        })
    return books


def search_web_for_books(queries: list[str], max_per_query: int = 5) -> list[dict]:
    """Search for books using Google Books with Open Library as fallback."""
    settings = get_settings()
    all_books: list[dict] = []
    seen: set[str] = set()
    google_failed = False

    for query in queries[:5]:
        results = []

        # Try Google Books first (skip if already failed for this batch)
        if not google_failed and settings.google_api_key:
            try:
                results = _search_google_books(query, max_per_query, settings.google_api_key)
            except Exception as exc:
                logger.warning("Google Books failed for '%s': %s. Falling back to Open Library.", query, exc)
                google_failed = True

        # Fallback to Open Library
        if not results:
            try:
                results = _search_open_library(query, max_per_query)
            except Exception as exc:
                logger.warning("Open Library search failed for '%s': %s", query, exc)
                continue

        for book in results:
            dedup_key = f"{book['title'].lower()}|{book['author'].lower()}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)
            all_books.append(book)

    return all_books


def rank_and_curate(paragraph: str, raw_books: list[dict]) -> list[dict]:
    """Use Gemini to rank and select the top 10 most relevant books."""
    if not raw_books:
        return []

    books_text = "\n".join(
        f"{i+1}. \"{b['title']}\" by {b['author']} — {(b.get('description') or '')[:150]}"
        for i, b in enumerate(raw_books[:25])
    )

    prompt = (
        f"A reader described what they want to read:\n\"{paragraph}\"\n\n"
        f"Here are candidate books:\n{books_text}\n\n"
        "Select the top 10 most relevant books and explain why each is relevant. "
        "Return a JSON array of objects with:\n"
        "- index: the 1-based number from the list above\n"
        "- relevance_reason: a brief (1 sentence) explanation of why this book matches\n\n"
        "Return ONLY valid JSON array, no markdown formatting. Order by relevance (most relevant first)."
    )

    try:
        llm = _get_llm()
        response = llm.invoke(prompt)
        # Convert response content to string to avoid Pydantic serialization warnings
        text = str(response.content).strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        rankings = json.loads(text)

        ranked_books = []
        for r in rankings[:10]:
            idx = r.get("index", 0) - 1
            if 0 <= idx < len(raw_books):
                book = raw_books[idx].copy()
                book["relevance_reason"] = r.get("relevance_reason", "")
                ranked_books.append(book)
        return ranked_books
    except Exception as exc:
        logger.error("Ranking failed: %s", exc)
        # Fallback: return first 10 unranked
        return raw_books[:10]


def cross_reference_catalog(books: list[dict]) -> list[dict]:
    """Check each discovered book against the library catalog."""
    supabase = get_supabase_admin()
    result = []

    for book in books:
        book["in_catalog"] = False
        book["catalog_book_id"] = None
        book["available_copies"] = None

        # Try ISBN match first
        if book.get("isbn"):
            isbn_result = (
                supabase.table("books")
                .select("id, available_copies")
                .eq("isbn", book["isbn"])
                .maybe_single()
                .execute()
            )
            if isbn_result and isbn_result.data:
                book["in_catalog"] = True
                book["catalog_book_id"] = isbn_result.data["id"]
                book["available_copies"] = isbn_result.data["available_copies"]
                result.append(book)
                continue

        # Try title+author ILIKE match
        title = book.get("title", "")
        author = book.get("author", "")
        if title:
            match_result = (
                supabase.table("books")
                .select("id, available_copies")
                .ilike("title", f"%{title}%")
                .ilike("author", f"%{author}%")
                .maybe_single()
                .execute()
            )
            if match_result and match_result.data:
                book["in_catalog"] = True
                book["catalog_book_id"] = match_result.data["id"]
                book["available_copies"] = match_result.data["available_copies"]

        result.append(book)

    return result


def discover_books(paragraph: str) -> dict:
    """Orchestrator: extract intent → search web → rank → cross-reference catalog."""
    intent = extract_search_intent(paragraph)
    queries = intent.get("search_queries", [paragraph.split()[:10]])

    if not queries:
        queries = [" ".join(paragraph.split()[:10])]

    raw_books = search_web_for_books(queries)

    if not raw_books:
        return {"books": [], "intent": intent, "total": 0}

    try:
        ranked_books = rank_and_curate(paragraph, raw_books)
    except Exception:
        ranked_books = raw_books[:10]

    final_books = cross_reference_catalog(ranked_books)

    return {
        "books": final_books,
        "intent": intent,
        "total": len(final_books),
    }
