from app.core.supabase import get_supabase_admin
from app.core.config import get_settings
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


def mark_overdue_records() -> int:
    """
    Mark all active borrow records whose due_date is in the past as 'overdue'.
    Optionally sends email reminders if Resend is configured.
    Returns the number of records updated.
    """
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    result = (
        supabase.table("borrow_records")
        .update({"status": "overdue"})
        .eq("status", "active")
        .lt("due_date", now_iso)
        .execute()
    )
    newly_overdue = result.data if result.data else []

    # Send overdue reminder emails if Resend is configured and there are new overdue records
    settings = get_settings()
    if newly_overdue and settings.resend_api_key:
        try:
            _send_overdue_reminders(supabase, newly_overdue, now)
        except Exception as exc:
            logger.warning("Failed to send overdue reminders: %s", exc)

    return len(newly_overdue)


def _send_overdue_reminders(supabase, overdue_records: list[dict], now: datetime) -> None:
    """Send overdue reminder emails to affected readers."""
    from app.services.email import send_overdue_reminder

    # Group overdue records by user
    user_books: dict[str, list[dict]] = {}
    book_ids = []
    for record in overdue_records:
        uid = record["user_id"]
        if uid not in user_books:
            user_books[uid] = []
        user_books[uid].append(record)
        book_ids.append(record["book_id"])

    # Fetch book details
    books_result = supabase.table("books").select("id, title, author").in_("id", book_ids).execute()
    books_map = {b["id"]: b for b in (books_result.data or [])}

    # Fetch user details
    user_ids = list(user_books.keys())
    users_result = supabase.table("users").select("id, email, name").in_("id", user_ids).execute()
    users_map = {u["id"]: u for u in (users_result.data or [])}

    for uid, records in user_books.items():
        user = users_map.get(uid)
        if not user:
            continue

        overdue_books = []
        for rec in records:
            book = books_map.get(rec["book_id"], {})
            due = datetime.fromisoformat(rec["due_date"].replace("Z", "+00:00"))
            days = max(0, (now - due).days)
            overdue_books.append({
                "title": book.get("title", "Unknown"),
                "author": book.get("author", "Unknown"),
                "due_date": rec["due_date"],
                "days_overdue": days,
            })

        send_overdue_reminder(
            reader_email=user["email"],
            reader_name=user.get("name"),
            overdue_books=overdue_books,
        )
