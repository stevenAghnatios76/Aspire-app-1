from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin
from app.schemas.book_request import BookRequestCreate, BookRequestOut
from typing import List

router = APIRouter(prefix="/api/book-requests", tags=["book-requests"])


@router.post("", response_model=BookRequestOut, status_code=status.HTTP_201_CREATED)
def create_book_request(
    request: BookRequestCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a book request (reader)."""
    supabase = get_supabase_admin()
    user_id = current_user["id"]

    # Check for duplicate pending request with same title
    existing = (
        supabase.table("book_requests")
        .select("id")
        .eq("user_id", user_id)
        .eq("title", request.title)
        .eq("status", "pending")
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending request for this book.",
        )

    data = request.model_dump(exclude_none=True)
    data["user_id"] = user_id

    result = supabase.table("book_requests").insert(data).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create book request.",
        )

    record = result.data[0]
    record["requester_name"] = current_user.get("name")
    record["requester_email"] = current_user.get("email")
    return record


@router.get("", response_model=List[BookRequestOut])
def get_my_book_requests(
    current_user: dict = Depends(get_current_user),
):
    """Get current user's book requests."""
    supabase = get_supabase_admin()

    result = (
        supabase.table("book_requests")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    records = result.data or []
    for r in records:
        r["requester_name"] = current_user.get("name")
        r["requester_email"] = current_user.get("email")
    return records
