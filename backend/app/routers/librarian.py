from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import require_librarian
from app.core.supabase import get_supabase_admin
from app.schemas.borrow import (
    DashboardStats,
    ReaderWithBorrowCount,
    BorrowHistoryItem,
    PendingReturnRecord,
    ReturnRequest,
    BorrowRecordResponse,
)
from app.schemas.book_request import BookRequestOut, BookRequestReview
from app.services.recommendations import get_reader_recommendations
from app.schemas.recommendation import RecommendationResponse
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import Query

router = APIRouter(prefix="/api/librarian", tags=["librarian"])


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    current_user: dict = Depends(require_librarian),
):
    """Get dashboard statistics (librarian only). Uses a single SQL RPC."""
    supabase = get_supabase_admin()

    # Single round trip instead of 6 sequential count queries
    result = supabase.rpc("get_dashboard_stats").execute()
    data = result.data if result.data else {}

    return DashboardStats(
        total_books=data.get("total_books", 0),
        total_checked_out=data.get("total_checked_out", 0),
        total_overdue=data.get("total_overdue", 0),
        total_readers=data.get("total_readers", 0),
        total_pending_returns=data.get("total_pending_returns", 0),
        total_pending_requests=data.get("total_pending_requests", 0),
    )


@router.get("/readers", response_model=List[ReaderWithBorrowCount])
def get_readers(
    current_user: dict = Depends(require_librarian),
):
    """Get all readers with their borrow counts (librarian only)."""
    supabase = get_supabase_admin()

    readers_result = supabase.table("users").select("*").eq("role", "reader").execute()
    readers = readers_result.data or []

    if not readers:
        return []

    reader_ids = [r["id"] for r in readers]

    borrows_result = (
        supabase.table("borrow_records")
        .select("user_id, status")
        .in_("user_id", reader_ids)
        .execute()
    )
    borrows = borrows_result.data or []

    active_counts: dict = defaultdict(int)
    total_counts: dict = defaultdict(int)
    for borrow in borrows:
        uid = borrow["user_id"]
        total_counts[uid] += 1
        if borrow["status"] in ("active", "overdue", "pending_return"):
            active_counts[uid] += 1

    result = []
    for reader in readers:
        uid = reader["id"]
        result.append(
            ReaderWithBorrowCount(
                **reader,
                active_borrow_count=active_counts[uid],
                total_borrow_count=total_counts[uid],
            )
        )
    return result


@router.get("/readers/{user_id}", response_model=ReaderWithBorrowCount)
def get_reader(
    user_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Get a specific reader's profile with borrow counts (librarian only)."""
    supabase = get_supabase_admin()

    reader_result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    if not reader_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reader not found")

    reader = reader_result.data

    borrows_result = (
        supabase.table("borrow_records")
        .select("status")
        .eq("user_id", user_id)
        .execute()
    )
    borrows = borrows_result.data or []
    active_count = sum(1 for b in borrows if b["status"] in ("active", "overdue", "pending_return"))

    return ReaderWithBorrowCount(
        **reader,
        active_borrow_count=active_count,
        total_borrow_count=len(borrows),
    )


@router.get("/readers/{user_id}/history", response_model=List[BorrowHistoryItem])
def get_reader_history(
    user_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Get a specific reader's borrow history (librarian only)."""
    supabase = get_supabase_admin()

    result = (
        supabase.table("borrow_records")
        .select("*, book:books(id, title, author, cover_url)")
        .eq("user_id", user_id)
        .order("borrowed_at", desc=True)
        .execute()
    )

    return result.data or []


@router.get("/pending-returns", response_model=List[PendingReturnRecord])
def get_pending_returns(
    current_user: dict = Depends(require_librarian),
):
    """Get all borrow records with pending return requests (librarian only)."""
    supabase = get_supabase_admin()

    result = (
        supabase.table("borrow_records")
        .select("*, book:books(id, title, author, cover_url), user:users(id, name, email, avatar_url)")
        .eq("status", "pending_return")
        .order("due_date", desc=False)
        .execute()
    )

    return result.data or []


@router.post("/approve-return", response_model=BorrowRecordResponse)
def approve_return(
    request: ReturnRequest,
    current_user: dict = Depends(require_librarian),
):
    """Approve a pending return request (librarian only)."""
    supabase = get_supabase_admin()
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

    if record["status"] != "pending_return":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This record does not have a pending return request",
        )

    # Complete the return
    now = datetime.now(timezone.utc)
    updated_result = (
        supabase.table("borrow_records")
        .update({"returned_at": now.isoformat(), "status": "returned"})
        .eq("id", record_id)
        .execute()
    )
    if not updated_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update borrow record",
        )

    # Increment available_copies; if book was checked_out, set to available
    book_result = (
        supabase.table("books").select("*").eq("id", record["book_id"]).single().execute()
    )
    if book_result.data:
        book = book_result.data
        new_available = book["available_copies"] + 1
        book_update = {"available_copies": new_available}
        if book["status"] == "checked_out":
            book_update["status"] = "available"
        supabase.table("books").update(book_update).eq("id", book["id"]).execute()

    return updated_result.data[0]


@router.get("/readers/{user_id}/recommendations", response_model=RecommendationResponse)
def get_reader_recommendations_endpoint(
    user_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Get AI-powered personalized book recommendations for a reader (librarian only)."""
    supabase = get_supabase_admin()

    # Validate target user exists
    reader_result = supabase.table("users").select("id").eq("id", user_id).single().execute()
    if not reader_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reader not found")

    result = get_reader_recommendations(user_id)
    return result


@router.get("/pending-checkouts", response_model=List[PendingReturnRecord])
def get_pending_checkouts(
    current_user: dict = Depends(require_librarian),
):
    """Get all borrow records awaiting checkout approval (librarian only)."""
    supabase = get_supabase_admin()
    result = (
        supabase.table("borrow_records")
        .select("*, book:books(id, title, author, cover_url), user:users(id, name, email, avatar_url)")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.post("/borrow/{borrow_id}/approve", response_model=BorrowRecordResponse)
def approve_checkout(
    borrow_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Approve a pending checkout request (librarian only)."""
    supabase = get_supabase_admin()

    record_result = (
        supabase.table("borrow_records").select("*").eq("id", borrow_id).single().execute()
    )
    if not record_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrow record not found")

    record = record_result.data
    if record["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This record is not pending approval",
        )

    # Check book still has available copies
    book_result = supabase.table("books").select("*").eq("id", record["book_id"]).single().execute()
    if not book_result.data or book_result.data["available_copies"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No copies available for this book",
        )

    # Approve: set status to active, set borrowed_at + due_date to now
    now = datetime.now(timezone.utc)
    due_date = now + timedelta(days=14)
    updated = (
        supabase.table("borrow_records")
        .update({
            "status": "active",
            "borrowed_at": now.isoformat(),
            "due_date": due_date.isoformat(),
        })
        .eq("id", borrow_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve checkout",
        )

    # Decrement available_copies
    book = book_result.data
    new_available = book["available_copies"] - 1
    book_update: dict = {"available_copies": new_available}
    if new_available == 0:
        book_update["status"] = "checked_out"
    supabase.table("books").update(book_update).eq("id", book["id"]).execute()

    return updated.data[0]


@router.post("/borrow/{borrow_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_checkout(
    borrow_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Reject a pending checkout request (librarian only)."""
    supabase = get_supabase_admin()

    record_result = (
        supabase.table("borrow_records").select("*").eq("id", borrow_id).single().execute()
    )
    if not record_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrow record not found")

    if record_result.data["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This record is not pending approval",
        )

    # Delete the rejected borrow record
    supabase.table("borrow_records").delete().eq("id", borrow_id).execute()
    return None


@router.post("/readers/{user_id}/send-recommendations")
def send_recommendations_email(
    user_id: str,
    current_user: dict = Depends(require_librarian),
):
    """Generate recommendations and send them to a reader via email (librarian only)."""
    from app.services.email import send_recommendation_email

    supabase = get_supabase_admin()

    # Get reader info
    reader_result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    if not reader_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reader not found")

    reader = reader_result.data

    # Generate recommendations
    rec_result = get_reader_recommendations(user_id)
    if not rec_result["books"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=rec_result.get("message", "No recommendations available"),
        )

    # Send email
    success = send_recommendation_email(
        reader_email=reader["email"],
        reader_name=reader.get("name"),
        recommendations=rec_result["books"],
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email. Check RESEND_API_KEY configuration.",
        )

    return {"message": f"Recommendations sent to {reader['email']}"}


@router.get("/book-requests", response_model=List[BookRequestOut])
def get_book_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(require_librarian),
):
    """Get all book requests with requester info (librarian only)."""
    supabase = get_supabase_admin()

    query = supabase.table("book_requests").select("*, requester:users!book_requests_user_id_fkey(name, email)")

    if status_filter:
        query = query.eq("status", status_filter)

    result = query.order("created_at", desc=True).execute()
    records = result.data or []

    # Flatten requester info
    out = []
    for r in records:
        requester = r.pop("requester", None) or {}
        r["requester_name"] = requester.get("name")
        r["requester_email"] = requester.get("email")
        out.append(r)
    return out


@router.post("/book-requests/{request_id}/review", response_model=BookRequestOut)
def review_book_request(
    request_id: str,
    review: BookRequestReview,
    current_user: dict = Depends(require_librarian),
):
    """Approve or reject a book request (librarian only)."""
    supabase = get_supabase_admin()

    # Fetch the request
    req_result = (
        supabase.table("book_requests")
        .select("*")
        .eq("id", request_id)
        .single()
        .execute()
    )
    if not req_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book request not found")

    request_data = req_result.data
    if request_data["status"] != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This request has already been reviewed.",
        )

    now = datetime.now(timezone.utc)
    new_status = "approved" if review.action == "approve" else "rejected"

    update_data: dict = {
        "status": new_status,
        "reviewed_by": current_user["id"],
        "reviewed_at": now.isoformat(),
    }
    if review.note:
        update_data["librarian_note"] = review.note

    updated = (
        supabase.table("book_requests")
        .update(update_data)
        .eq("id", request_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update book request.",
        )

    record = updated.data[0]

    # If approved, optionally auto-create the book in catalog
    if review.action == "approve":
        book_data = {
            "title": request_data["title"],
            "status": "available",
            "total_copies": 1,
            "available_copies": 1,
        }
        if request_data.get("author"):
            book_data["author"] = request_data["author"]
        else:
            book_data["author"] = "Unknown"
        if request_data.get("isbn"):
            book_data["isbn"] = request_data["isbn"]
        if request_data.get("cover_url"):
            book_data["cover_url"] = request_data["cover_url"]
        if request_data.get("description"):
            book_data["description"] = request_data["description"]

        try:
            supabase.table("books").insert(book_data).execute()
            # Mark as fulfilled
            supabase.table("book_requests").update({"status": "fulfilled"}).eq("id", request_id).execute()
            record["status"] = "fulfilled"
        except Exception:
            pass  # Book creation is best-effort

    # Fetch requester info
    user_result = (
        supabase.table("users")
        .select("name, email")
        .eq("id", request_data["user_id"])
        .maybe_single()
        .execute()
    )
    record["requester_name"] = user_result.data.get("name") if user_result.data else None
    record["requester_email"] = user_result.data.get("email") if user_result.data else None

    return record
