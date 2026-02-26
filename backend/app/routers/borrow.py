from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user, require_librarian
from app.core.supabase import get_supabase_admin
from app.schemas.borrow import (
    BorrowRequest,
    ReturnRequest,
    BorrowRecordResponse,
    BorrowHistoryItem,
    OverdueBorrowRecord,
)
from app.services.overdue import mark_overdue_records
from datetime import datetime, timedelta, timezone
from typing import List

router = APIRouter(prefix="/api/borrow", tags=["borrow"])


@router.post("", response_model=BorrowRecordResponse, status_code=status.HTTP_201_CREATED)
async def borrow_book(
    request: BorrowRequest,
    current_user: dict = Depends(get_current_user),
):
    """Borrow a book (any authenticated user)."""
    mark_overdue_records()
    supabase = get_supabase_admin()
    user_id = current_user["id"]
    book_id = request.book_id

    # Check book exists and has available copies
    book_result = supabase.table("books").select("*").eq("id", book_id).single().execute()
    if not book_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    book = book_result.data
    if book["available_copies"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No copies available",
        )

    # Check user doesn't already have an active borrow of this book
    existing = (
        supabase.table("borrow_records")
        .select("id")
        .eq("user_id", user_id)
        .eq("book_id", book_id)
        .in_("status", ["pending", "active", "overdue", "pending_return"])
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active or pending borrow for this book",
        )

    # Create borrow record with 'pending' status (librarian must approve)
    now = datetime.now(timezone.utc)
    record_data = {
        "user_id": user_id,
        "book_id": book_id,
        "borrowed_at": now.isoformat(),
        "due_date": (now + timedelta(days=14)).isoformat(),
        "status": "pending",
    }
    record_result = supabase.table("borrow_records").insert(record_data).execute()
    if not record_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create borrow record",
        )

    # Note: available_copies is NOT decremented here — it happens when librarian approves

    return record_result.data[0]


@router.post("/return", response_model=BorrowRecordResponse)
async def return_book(
    request: ReturnRequest,
    current_user: dict = Depends(get_current_user),
):
    """Return a borrowed book (any authenticated user)."""
    supabase = get_supabase_admin()
    user_id = current_user["id"]
    record_id = request.borrow_record_id

    # Fetch the borrow record
    record_result = (
        supabase.table("borrow_records").select("*").eq("id", record_id).single().execute()
    )
    if not record_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Borrow record not found"
        )

    record = record_result.data

    # Ownership check
    if record["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only return your own borrowed books",
        )

    # Status check
    if record["status"] not in ("active", "overdue"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This book has already been returned or has a pending return request",
        )

    # Set status to pending_return (librarian must approve to complete the return)
    updated_result = (
        supabase.table("borrow_records")
        .update({"status": "pending_return"})
        .eq("id", record_id)
        .execute()
    )
    if not updated_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update borrow record",
        )

    return updated_result.data[0]


@router.get("/history", response_model=List[BorrowHistoryItem])
async def get_my_history(
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's borrow history."""
    mark_overdue_records()
    supabase = get_supabase_admin()
    user_id = current_user["id"]

    result = (
        supabase.table("borrow_records")
        .select("*, book:books(id, title, author, cover_url)")
        .eq("user_id", user_id)
        .order("borrowed_at", desc=True)
        .execute()
    )

    return result.data or []


@router.get("/overdue", response_model=List[OverdueBorrowRecord])
async def get_overdue_records(
    current_user: dict = Depends(require_librarian),
):
    """Get all overdue borrow records (librarian only)."""
    mark_overdue_records()
    supabase = get_supabase_admin()

    result = (
        supabase.table("borrow_records")
        .select("*, book:books(id, title, author, cover_url), user:users(id, name, email, avatar_url)")
        .eq("status", "overdue")
        .order("due_date", desc=False)
        .execute()
    )

    return result.data or []
