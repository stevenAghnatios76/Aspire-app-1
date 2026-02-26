import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_resend_client = None


def _get_resend():
    """Lazy-initialize the Resend client."""
    global _resend_client
    if _resend_client is None:
        import resend

        settings = get_settings()
        if not settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")
        resend.api_key = settings.resend_api_key
        _resend_client = resend
    return _resend_client


def send_recommendation_email(
    reader_email: str,
    reader_name: str | None,
    recommendations: list[dict],
) -> bool:
    """
    Send personalized book recommendations to a reader via email.
    Returns True on success, False on failure.
    """
    resend = _get_resend()
    name = reader_name or "Reader"

    # Build HTML for recommendation cards
    book_cards = ""
    for book in recommendations:
        cover_html = ""
        if book.get("cover_url"):
            cover_html = f'<img src="{book["cover_url"]}" alt="{book["title"]}" style="width:60px;height:80px;object-fit:cover;border-radius:4px;margin-right:12px;" />'
        else:
            cover_html = '<div style="width:60px;height:80px;background:#e5e7eb;border-radius:4px;margin-right:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">📖</div>'

        book_cards += f"""
        <div style="display:flex;align-items:center;padding:12px;margin-bottom:8px;background:#f9fafb;border-radius:8px;">
            {cover_html}
            <div>
                <div style="font-weight:600;color:#111827;">{book["title"]}</div>
                <div style="color:#6b7280;font-size:14px;">{book["author"]}</div>
                <div style="color:#7c3aed;font-size:13px;margin-top:4px;">{book.get("similarity", 0)}% match</div>
            </div>
        </div>
        """

    html_body = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="color:#4f46e5;font-size:24px;">📚 Book Recommendations for You</h1>
        <p style="color:#374151;">Hi {name},</p>
        <p style="color:#374151;">Your librarian has picked these personalized book recommendations based on your reading history:</p>
        <div style="margin:24px 0;">
            {book_cards}
        </div>
        <p style="color:#6b7280;font-size:14px;">Visit the library to check out any of these books!</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">Mini Library Management System</p>
    </div>
    """

    try:
        resend.Emails.send(
            {
                "from": "Library <onboarding@resend.dev>",
                "to": [reader_email],
                "subject": f"📚 Personalized Book Recommendations for {name}",
                "html": html_body,
            }
        )
        logger.info("Recommendation email sent to %s", reader_email)
        return True
    except Exception as exc:
        logger.error("Failed to send recommendation email to %s: %s", reader_email, exc)
        return False


def send_overdue_reminder(
    reader_email: str,
    reader_name: str | None,
    overdue_books: list[dict],
) -> bool:
    """
    Send an overdue reminder email to a reader.
    Each item in overdue_books should have: title, author, due_date, days_overdue
    """
    resend = _get_resend()
    name = reader_name or "Reader"

    rows = ""
    for book in overdue_books:
        rows += f"""
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{book["title"]}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{book["author"]}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:600;">
                {book["days_overdue"]} day{"s" if book["days_overdue"] != 1 else ""} overdue
            </td>
        </tr>
        """

    html_body = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="color:#dc2626;font-size:24px;">⚠️ Overdue Book Reminder</h1>
        <p style="color:#374151;">Hi {name},</p>
        <p style="color:#374151;">The following book(s) are overdue. Please return them as soon as possible:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
                <tr style="background:#f3f4f6;">
                    <th style="padding:8px 12px;text-align:left;font-size:14px;color:#6b7280;">Title</th>
                    <th style="padding:8px 12px;text-align:left;font-size:14px;color:#6b7280;">Author</th>
                    <th style="padding:8px 12px;text-align:left;font-size:14px;color:#6b7280;">Status</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        <p style="color:#6b7280;font-size:14px;">Please visit the library or initiate a return from your account.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">Mini Library Management System</p>
    </div>
    """

    try:
        resend.Emails.send(
            {
                "from": "Library <onboarding@resend.dev>",
                "to": [reader_email],
                "subject": f"⚠️ Overdue Book Reminder for {name}",
                "html": html_body,
            }
        )
        logger.info("Overdue reminder sent to %s", reader_email)
        return True
    except Exception as exc:
        logger.error("Failed to send overdue reminder to %s: %s", reader_email, exc)
        return False
