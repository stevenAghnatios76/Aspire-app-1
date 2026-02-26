import httpx
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"


async def fetch_similar_books(
    title: str,
    author: str,
    genre: str | None,
    current_book_title: str,
) -> list[dict]:
    """
    Query Google Books API for similar books based on title, author, and genre.
    Returns up to 5 results (excluding the current book itself).
    """
    settings = get_settings()

    # Build query string from book metadata
    query_parts = []
    if title:
        query_parts.append(title)
    if author:
        query_parts.append(author)
    if genre:
        query_parts.append(genre)
    query = " ".join(query_parts)

    params: dict[str, str | int] = {
        "q": query,
        "maxResults": 6,  # fetch 6 so we can filter out the book itself and still get 5
        "printType": "books",
    }
    if settings.google_api_key:
        params["key"] = settings.google_api_key

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(GOOGLE_BOOKS_API_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        logger.warning("Google Books API request timed out for query: %s", query)
        return []
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Google Books API returned %s for query: %s", exc.response.status_code, query
        )
        return []
    except Exception as exc:
        logger.error("Google Books API error: %s", exc)
        return []

    items = data.get("items", [])
    if not items:
        return []

    results: list[dict] = []
    current_title_lower = current_book_title.lower().strip()

    for item in items:
        volume_info = item.get("volumeInfo", {})
        item_title = volume_info.get("title", "")

        # Skip the current book itself
        if item_title.lower().strip() == current_title_lower:
            continue

        authors = volume_info.get("authors", [])
        image_links = volume_info.get("imageLinks", {})
        thumbnail = image_links.get("thumbnail") or image_links.get("smallThumbnail")

        results.append(
            {
                "title": item_title,
                "author": authors[0] if authors else "Unknown",
                "cover_url": thumbnail,
                "google_books_url": volume_info.get("infoLink", ""),
            }
        )

        if len(results) >= 5:
            break

    return results
