from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from app.core.auth import get_current_user, require_librarian
from app.core.supabase import get_supabase_admin
from app.schemas.book import BookCreate, BookUpdate, BookResponse, PaginatedBooks, BookSummaryResponse
from app.schemas.recommendation import SimilarBook
from app.services.book_summary import get_or_generate_summary
from app.core.rate_limit import summary_limiter
from app.services.embeddings import (
    get_embedding_text,
    generate_embedding,
    generate_and_store_embedding,
    batch_generate_embeddings,
)
import math
import csv
import io
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/books", tags=["books"])


@router.get("", response_model=PaginatedBooks)
async def list_books(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """List all books with pagination."""
    supabase = get_supabase_admin()
    offset = (page - 1) * limit

    # Get total count
    count_result = supabase.table("books").select("id", count="exact").execute()
    total = count_result.count or 0

    # Get paginated results
    result = (
        supabase.table("books")
        .select("*")
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


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single book by ID."""
    supabase = get_supabase_admin()
    result = supabase.table("books").select("*").eq("id", book_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    return result.data


@router.get("/{book_id}/summary", response_model=BookSummaryResponse)
async def get_book_summary(
    book_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get an AI-generated summary for a book (cached)."""
    summary_limiter.check(current_user["id"])
    return get_or_generate_summary(book_id)


@router.get("/{book_id}/similar", response_model=list[SimilarBook])
async def get_similar_books(
    book_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get similar books using pgvector cosine similarity on embeddings."""
    supabase = get_supabase_admin()

    # Fetch the book's embedding
    book_result = (
        supabase.table("books")
        .select("id, title, author, genre, description, embedding")
        .eq("id", book_id)
        .single()
        .execute()
    )
    if not book_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    book = book_result.data
    embedding = book.get("embedding")

    # If this book has no embedding, generate one on the fly
    if not embedding:
        try:
            text = get_embedding_text(book)
            embedding = generate_embedding(text)
            generate_and_store_embedding(book_id, text)
        except Exception as exc:
            logger.error("Failed to generate embedding for book %s: %s", book_id, exc)
            return []

    # Use RPC to find similar books (excluding the current book)
    try:
        rpc_result = supabase.rpc(
            "find_similar_books",
            {
                "query_embedding": str(embedding),
                "exclude_book_id": book_id,
                "result_limit": 5,
            },
        ).execute()
    except Exception as exc:
        logger.error("RPC find_similar_books failed: %s", exc)
        return []

    return rpc_result.data or []


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_book(
    book: BookCreate,
    current_user: dict = Depends(require_librarian),
):
    """Create a new book (librarian only)."""
    supabase = get_supabase_admin()

    book_data = book.model_dump(exclude_none=True)

    # Set status based on available copies
    if book_data.get("available_copies", 1) > 0:
        book_data["status"] = "available"
    else:
        book_data["status"] = "unavailable"

    result = supabase.table("books").insert(book_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create book",
        )

    created_book = result.data[0]

    # Generate embedding for the new book (non-blocking on failure)
    try:
        text = get_embedding_text(created_book)
        generate_and_store_embedding(created_book["id"], text)
    except Exception as exc:
        logger.warning("Failed to generate embedding for new book %s: %s", created_book["id"], exc)

    return created_book


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    book: BookUpdate,
    current_user: dict = Depends(require_librarian),
):
    """Update a book (librarian only)."""
    supabase = get_supabase_admin()

    # Check book exists
    existing = supabase.table("books").select("*").eq("id", book_id).single().execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    update_data = book.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = (
        supabase.table("books")
        .update(update_data)
        .eq("id", book_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update book",
        )

    updated_book = result.data[0]

    # Regenerate embedding if description changed
    if "description" in update_data or "title" in update_data or "author" in update_data or "genre" in update_data:
        try:
            text = get_embedding_text(updated_book)
            generate_and_store_embedding(book_id, text)
        except Exception as exc:
            logger.warning("Failed to regenerate embedding for book %s: %s", book_id, exc)

    return updated_book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Delete a book (librarian only)."""
    supabase = get_supabase_admin()

    # Check book exists
    existing = supabase.table("books").select("id").eq("id", book_id).single().execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    supabase.table("books").delete().eq("id", book_id).execute()
    return None


@router.post("/generate-embeddings")
async def generate_embeddings_endpoint(
    current_user: dict = Depends(require_librarian),
):
    """Generate embeddings for all books that don't have one yet (librarian only)."""
    count = batch_generate_embeddings()
    if count == 0:
        return {"processed": 0, "message": "All books already have embeddings."}
    return {"processed": count, "message": f"Generated embeddings for {count} book(s)."}


def _parse_csv_row(row: dict, row_num: int) -> tuple[dict | None, dict | None]:
    """Parse a single CSV row into book_data dict. Returns (book_data, error)."""
    title = (row.get("title") or "").strip()
    author = (row.get("author") or "").strip()
    if not title or not author:
        return None, {"row": row_num, "reason": "Missing title or author"}

    book_data: dict = {"title": title, "author": author, "status": "available"}

    for field in ["isbn", "genre", "description", "cover_url"]:
        val = (row.get(field) or "").strip()
        if val:
            book_data[field] = val

    year_str = (row.get("published_year") or "").strip()
    if year_str:
        try:
            book_data["published_year"] = int(year_str)
        except ValueError:
            return None, {"row": row_num, "reason": f"Invalid published_year: {year_str}"}

    total_copies = int((row.get("total_copies") or "").strip() or "1")
    available_copies = int((row.get("available_copies") or "").strip() or str(total_copies))
    book_data["total_copies"] = total_copies
    book_data["available_copies"] = available_copies
    return book_data, None


@router.post("/import-csv")
async def import_books_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_librarian),
):
    """Import books from a CSV file (librarian only)."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .csv file",
        )

    contents = await file.read()
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded",
        )

    reader = csv.DictReader(io.StringIO(text))
    required_fields = {"title", "author"}
    if not reader.fieldnames or not required_fields.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV must have at least these columns: {', '.join(required_fields)}",
        )

    supabase = get_supabase_admin()
    imported = 0
    errors: list[dict] = []

    for row_num, row in enumerate(reader, start=2):
        book_data, parse_error = _parse_csv_row(row, row_num)
        if parse_error:
            errors.append(parse_error)
            continue

        try:
            result = supabase.table("books").insert(book_data).execute()
            if result.data:
                created = result.data[0]
                imported += 1
                try:
                    text_for_embed = get_embedding_text(created)
                    generate_and_store_embedding(created["id"], text_for_embed)
                except Exception as exc:
                    logger.warning("Embedding failed for imported book row %d: %s", row_num, exc)
            else:
                errors.append({"row": row_num, "reason": "Insert failed"})
        except Exception as exc:
            errors.append({"row": row_num, "reason": str(exc)})

    return {"imported": imported, "errors": errors}
