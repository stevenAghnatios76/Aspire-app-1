from typing import Annotated
from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.config import get_settings
from app.routers import books, search, auth, borrow, librarian, smart_search, discovery, book_requests

settings = get_settings()
logger = logging.getLogger(__name__)

APP_NAME = "Aspire Library"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = (
    "Production-ready full-stack library management platform with role-based workflows, "
    "AI-powered search, natural-language book discovery, and personalized recommendations."
)


async def _overdue_checker():
    """Background task: mark overdue records every 60 seconds."""
    from app.services.overdue import mark_overdue_records
    while True:
        try:
            count = mark_overdue_records()
            if count:
                logger.info("Marked %d record(s) as overdue", count)
        except Exception as exc:
            logger.warning("Overdue checker error: %s", exc)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — runs the overdue checker in the background."""
    task = asyncio.create_task(_overdue_checker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=APP_NAME,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
)

# CORS — settings.frontend_url can be a single URL or comma-separated list
_origins = [o.strip() for o in settings.frontend_url.split(",") if o.strip()]
if "http://localhost:3000" not in _origins:
    _origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — order matters: specific paths before /{book_id} catch-all
app.include_router(smart_search.router)
app.include_router(search.router)
app.include_router(discovery.router)
app.include_router(borrow.router)
app.include_router(book_requests.router)
app.include_router(librarian.router)
app.include_router(books.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {"message": f"{APP_NAME} API", "version": APP_VERSION}


@app.get("/health")
async def health():
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# /info — Full feature & API documentation (JSON or HTML)
# ---------------------------------------------------------------------------

def _build_info() -> dict:
    """Return the complete documentation payload."""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "description": APP_DESCRIPTION,
        "tech_stack": {
            "frontend": "Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4",
            "backend": "FastAPI 0.115, Pydantic 2.9, Uvicorn 0.30",
            "auth_and_database": "Supabase Auth + Postgres",
            "vector_search": "pgvector (768-dimensional embeddings)",
            "ai": "LangChain + Google Gemini (Embedding 001, Gemini 2.5 Flash)",
            "external_data": "Google Books API + Open Library (fallback)",
            "email": "Resend (optional)",
        },
        "architecture": {
            "summary": (
                "Next.js frontend authenticates via Supabase OAuth, sends JWT as Bearer token "
                "to FastAPI backend. Backend validates token, checks user role, and executes "
                "business logic against Supabase Postgres (service-role). AI features call "
                "Google Gemini for embeddings/LLM and external book APIs for discovery."
            ),
            "flow": [
                "1. User signs in via Google OAuth → Supabase issues JWT",
                "2. Frontend sends JWT as Authorization: Bearer <token> to FastAPI",
                "3. Backend validates token, resolves user profile and role",
                "4. Backend reads/writes Supabase Postgres using service-role credentials",
                "5. AI endpoints call Gemini for embeddings or LLM generation",
                "6. Discovery pipeline also calls Google Books API + Open Library",
                "7. Email notifications sent via Resend when configured",
            ],
        },
        "features": {
            "core": [
                {
                    "name": "Google OAuth Authentication",
                    "description": "Sign in with Google via Supabase Auth. JWT-based session management.",
                },
                {
                    "name": "Role-Based Access Control",
                    "description": "Two roles: Reader and Librarian. Route-level middleware blocks unauthorized access. Readers cannot access /librarian/* routes.",
                },
                {
                    "name": "Onboarding Flow",
                    "description": "First-time users are redirected to /onboarding to choose their role (Reader or Librarian).",
                },
                {
                    "name": "Book Catalog",
                    "description": "Paginated book browsing with genre and availability status filter dropdowns.",
                },
                {
                    "name": "Borrow Workflow",
                    "description": "Reader requests checkout → Librarian approves/rejects → available copies auto-managed. Active borrows become overdue after due date.",
                },
                {
                    "name": "Return Workflow",
                    "description": "Reader submits return request → Librarian approves → copies restored to catalog.",
                },
                {
                    "name": "Live Borrow History",
                    "description": "Reader's /reader/history page auto-refreshes every 10 seconds, showing real-time status changes (pending, active, overdue, pending_return, returned).",
                },
                {
                    "name": "Book Request System",
                    "description": "Readers can request books not in the catalog. Librarians review with optional notes. Approving auto-creates the book in the catalog.",
                },
                {
                    "name": "Classic Keyword Search",
                    "description": "ILIKE-based search across title, author, ISBN, and description with genre/status filters and pagination.",
                },
            ],
            "ai_powered": [
                {
                    "name": "Smart Search (Hybrid Semantic + Keyword)",
                    "description": "Combines pgvector cosine similarity with ILIKE keyword matching. Short queries (<3 words) use keyword-only. Results are merged, deduplicated, and ranked with semantic matches first. Each result includes a relevance percentage badge.",
                    "endpoint": "GET /api/books/smart-search?q=<query>",
                    "model": "Google Gemini Embedding 001 (768 dimensions)",
                    "rate_limit": None,
                    "how_to_use": [
                        "Toggle 'AI mode' on the /books catalog page",
                        "Type a natural-language query like 'hobbits on an adventure' or 'dark political sci-fi'",
                        "Results show relevance % badges — higher means better semantic match",
                        "For short queries (1-2 words), falls back to classic keyword search automatically",
                    ],
                    "example_queries": [
                        "hobbits on an adventure",
                        "sand desert and a messiah",
                        "dark political sci-fi with philosophical themes",
                        "cozy mystery in a small town with amateur detective",
                        "coming of age story set in the American South",
                        "time travel romance with a twist ending",
                    ],
                },
                {
                    "name": "AI Book Discovery",
                    "description": "Full pipeline: user writes a paragraph describing what they want → Gemini 2.5 Flash extracts search intent and generates multiple queries → searches Google Books API (with Open Library fallback) → Gemini ranks and curates results → cross-references your library catalog to show 'In Library' badges with live availability.",
                    "endpoint": "POST /api/books/discover",
                    "model": "Gemini 2.5 Flash (intent extraction + ranking), Google Books API, Open Library API",
                    "rate_limit": "10 requests per hour per user",
                    "how_to_use": [
                        "Navigate to /reader/discover",
                        "Write a paragraph (20-2000 characters) describing the kind of book you want",
                        "Click 'Discover Books' — AI processes your paragraph, searches the web, ranks results",
                        "Results show 'In Library' badge if the book exists in your catalog with availability count",
                        "Click 'Request This Book' on any title not in the catalog to submit a book request",
                    ],
                    "example_input": "I want an epic fantasy about unlikely companions crossing dangerous lands with loyalty, humor, and a dark enemy rising.",
                },
                {
                    "name": "AI Book Summaries",
                    "description": "Generates concise 3-4 sentence AI summaries for any book using Gemini 2.5 Flash. Summaries are cached in the book_summaries table so subsequent requests are instant. Rate-limited to prevent abuse.",
                    "endpoint": "GET /api/books/{book_id}/summary",
                    "model": "Gemini 2.5 Flash via LangChain",
                    "rate_limit": "30 requests per hour per user",
                    "how_to_use": [
                        "Open any book detail page at /books/{id}",
                        "Click the 'AI Summary' button",
                        "First request generates the summary (may take 2-3 seconds)",
                        "Subsequent requests for the same book return the cached version instantly",
                    ],
                },
                {
                    "name": "Similar Books",
                    "description": "Finds books with similar content using pgvector cosine similarity on 768-dimensional Gemini embeddings. Shows 'You might also like' recommendations on each book's detail page.",
                    "endpoint": "GET /api/books/{book_id}/similar",
                    "model": "pgvector cosine similarity on Gemini Embedding 001 vectors",
                    "rate_limit": None,
                    "how_to_use": [
                        "Open any book detail page at /books/{id}",
                        "Scroll down to the 'You might also like' section",
                        "Similar books are computed from vector embeddings — quality depends on embeddings being generated for catalog books",
                    ],
                },
                {
                    "name": "Personalized Reader Recommendations",
                    "description": "Builds a 'taste profile' for each reader by averaging the embeddings of all books they have borrowed. Then uses pgvector cosine similarity to find unread books that match their taste. Librarians can generate and optionally email these recommendations.",
                    "endpoint": "GET /api/librarian/readers/{user_id}/recommendations",
                    "model": "numpy (embedding averaging) + pgvector cosine similarity",
                    "rate_limit": None,
                    "how_to_use": [
                        "As a librarian, open /librarian/readers/{userId}",
                        "Click 'Recommend Books' to generate personalized AI recommendations",
                        "Recommendations are based on the reader's entire borrow history",
                        "Click 'Send via Email' to email the recommendations (requires RESEND_API_KEY)",
                        "Quality improves as the reader borrows more books and the catalog has more embeddings",
                    ],
                },
                {
                    "name": "Auto-Embedding Generation",
                    "description": "768-dimensional vector embeddings are automatically generated using Google Gemini Embedding 001 whenever a book is created or updated. A batch endpoint exists for backfilling older books that were added before embeddings were enabled.",
                    "endpoint": "POST /api/books/generate-embeddings (batch) — also auto-runs on POST/PUT /api/books",
                    "model": "Google Gemini Embedding 001 (768 dimensions) via LangChain",
                    "rate_limit": None,
                    "how_to_use": [
                        "Embeddings are generated automatically when you create or edit a book — no action needed",
                        "For bulk backfill: go to the librarian dashboard and click 'Generate Embeddings'",
                        "This processes all books that don't yet have an embedding vector",
                        "All AI features (smart search, similar books, recommendations) depend on embeddings",
                    ],
                },
            ],
            "librarian_tools": [
                {
                    "name": "Dashboard",
                    "description": "6 live stat cards: total books, checked out, overdue, pending returns, book requests, reader count.",
                },
                {
                    "name": "Book Management",
                    "description": "Add new books manually, edit existing books, delete books. Embeddings auto-generated on create/update.",
                },
                {
                    "name": "CSV Bulk Import",
                    "description": "Import books from CSV file. Required columns: title, author, isbn, genre, description, cover_url, published_year, total_copies.",
                },
                {
                    "name": "Checkout Approval Queue",
                    "description": "View and approve/reject pending borrow requests. Approval decrements available copies.",
                },
                {
                    "name": "Return Approval Queue",
                    "description": "View and approve pending return requests. Approval increments available copies.",
                },
                {
                    "name": "Book Request Review",
                    "description": "Review reader book requests with optional notes. Approving auto-creates the book in the catalog.",
                },
                {
                    "name": "Reader Management",
                    "description": "View reader list, individual profiles with borrow history, generate AI recommendations, send recommendation emails.",
                },
                {
                    "name": "Email Notifications",
                    "description": "Personalized recommendation emails (librarian-triggered) and overdue reminder emails (auto-sent). Requires RESEND_API_KEY.",
                },
            ],
        },
        "endpoints": [
            {"method": "GET", "path": "/", "auth": "None", "purpose": "API root — name and version"},
            {"method": "GET", "path": "/health", "auth": "None", "purpose": "Health check"},
            {"method": "GET", "path": "/info", "auth": "None", "purpose": "Full documentation (JSON or HTML via ?format=html)"},
            {"method": "GET", "path": "/docs", "auth": "None", "purpose": "Swagger UI (auto-generated)"},
            {"method": "GET", "path": "/api/auth/me", "auth": "Any", "purpose": "Current user profile"},
            {"method": "POST", "path": "/api/auth/setup", "auth": "Any", "purpose": "Create user profile with role"},
            {"method": "GET", "path": "/api/books", "auth": "Any", "purpose": "Paginated catalog with genre/status filters"},
            {"method": "GET", "path": "/api/books/{book_id}", "auth": "Any", "purpose": "Book detail"},
            {"method": "POST", "path": "/api/books", "auth": "Librarian", "purpose": "Create book (auto-generates embedding)"},
            {"method": "PUT", "path": "/api/books/{book_id}", "auth": "Librarian", "purpose": "Update book (regenerates embedding)"},
            {"method": "DELETE", "path": "/api/books/{book_id}", "auth": "Librarian", "purpose": "Delete book"},
            {"method": "POST", "path": "/api/books/import-csv", "auth": "Librarian", "purpose": "Bulk CSV import"},
            {"method": "POST", "path": "/api/books/generate-embeddings", "auth": "Librarian", "purpose": "Batch-generate missing embeddings"},
            {"method": "GET", "path": "/api/books/search", "auth": "Any", "purpose": "Classic keyword search (ILIKE)"},
            {"method": "GET", "path": "/api/books/smart-search", "auth": "Any", "purpose": "AI hybrid semantic + keyword search"},
            {"method": "GET", "path": "/api/books/{book_id}/similar", "auth": "Any", "purpose": "Similar books via pgvector cosine similarity"},
            {"method": "GET", "path": "/api/books/{book_id}/summary", "auth": "Any", "rate_limit": "30/hr per user", "purpose": "AI book summary (Gemini, cached)"},
            {"method": "POST", "path": "/api/books/discover", "auth": "Any", "rate_limit": "10/hr per user", "purpose": "Paragraph-based AI book discovery"},
            {"method": "POST", "path": "/api/borrow", "auth": "Any", "purpose": "Request checkout"},
            {"method": "POST", "path": "/api/borrow/return", "auth": "Any", "purpose": "Request return"},
            {"method": "GET", "path": "/api/borrow/history", "auth": "Any", "purpose": "Current user borrow history"},
            {"method": "GET", "path": "/api/borrow/overdue", "auth": "Librarian", "purpose": "All overdue records"},
            {"method": "GET", "path": "/api/librarian/dashboard", "auth": "Librarian", "purpose": "Dashboard stats (6 metrics)"},
            {"method": "GET", "path": "/api/librarian/readers", "auth": "Librarian", "purpose": "Reader list with borrow counts"},
            {"method": "GET", "path": "/api/librarian/readers/{user_id}", "auth": "Librarian", "purpose": "Reader profile"},
            {"method": "GET", "path": "/api/librarian/readers/{user_id}/history", "auth": "Librarian", "purpose": "Reader borrow history"},
            {"method": "GET", "path": "/api/librarian/readers/{user_id}/recommendations", "auth": "Librarian", "purpose": "AI personalized recommendations"},
            {"method": "POST", "path": "/api/librarian/readers/{user_id}/send-recommendations", "auth": "Librarian", "purpose": "Email recommendations"},
            {"method": "GET", "path": "/api/librarian/pending-checkouts", "auth": "Librarian", "purpose": "Pending checkout queue"},
            {"method": "POST", "path": "/api/librarian/borrow/{borrow_id}/approve", "auth": "Librarian", "purpose": "Approve checkout"},
            {"method": "POST", "path": "/api/librarian/borrow/{borrow_id}/reject", "auth": "Librarian", "purpose": "Reject checkout"},
            {"method": "GET", "path": "/api/librarian/pending-returns", "auth": "Librarian", "purpose": "Pending return queue"},
            {"method": "POST", "path": "/api/librarian/approve-return", "auth": "Librarian", "purpose": "Approve return"},
            {"method": "POST", "path": "/api/book-requests", "auth": "Any", "purpose": "Submit book request"},
            {"method": "GET", "path": "/api/book-requests", "auth": "Any", "purpose": "My book requests"},
            {"method": "GET", "path": "/api/librarian/book-requests", "auth": "Librarian", "purpose": "All book requests (optional ?status= filter)"},
            {"method": "POST", "path": "/api/librarian/book-requests/{request_id}/review", "auth": "Librarian", "purpose": "Approve/reject request with notes"},
        ],
        "rate_limits": [
            {
                "feature": "AI Book Discovery",
                "endpoint": "POST /api/books/discover",
                "limit": "10 requests per hour per user",
                "type": "In-memory sliding window (per-instance, resets on restart)",
            },
            {
                "feature": "AI Book Summary",
                "endpoint": "GET /api/books/{book_id}/summary",
                "limit": "30 requests per hour per user",
                "type": "In-memory sliding window (per-instance, resets on restart)",
            },
        ],
        "walkthrough": {
            "reader_flow": [
                "1. Sign in with Google → redirected to /onboarding → choose Reader",
                "2. Browse /books catalog — use genre and status dropdown filters",
                "3. Toggle AI mode for natural-language search (e.g., 'hobbits on an adventure') — see relevance % badges",
                "4. Open any book detail (/books/{id}) — try Borrow, AI Summary, and see Similar Books",
                "5. Check /reader/history — view borrow statuses, submit returns, page auto-refreshes every 10s",
                "6. Try /reader/discover — paste a paragraph describing what you want, see AI-curated results with 'In Library' badges",
                "7. Request books not in catalog from discovery results",
                "8. Track requests at /reader/requests — see status and librarian notes",
            ],
            "librarian_flow": [
                "1. Open /librarian/dashboard — 6 stat cards with live metrics",
                "2. Approve/reject pending checkouts (copies auto-managed)",
                "3. Approve pending returns (copies restored)",
                "4. Review book requests — approving auto-creates the book in catalog",
                "5. Generate Embeddings to batch-create missing AI vectors",
                "6. Import Books from CSV for bulk catalog additions",
                "7. Add/edit/delete books manually",
                "8. View reader profiles — generate AI recommendations, send via email",
                "9. Monitor overdue section — reminder emails auto-sent when RESEND_API_KEY is set",
            ],
        },
    }


def _render_html(info: dict) -> str:
    """Render the info dict as a self-contained HTML documentation page."""

    # --- helpers ---
    def _badge(text: str, color: str = "#6366f1") -> str:
        return (
            f'<span style="display:inline-block;padding:2px 10px;border-radius:9999px;'
            f'font-size:0.75rem;font-weight:600;color:#fff;background:{color};margin-right:4px;">'
            f'{text}</span>'
        )

    def _method_color(m: str) -> str:
        return {"GET": "#22c55e", "POST": "#3b82f6", "PUT": "#f59e0b", "DELETE": "#ef4444"}.get(m, "#6b7280")

    # --- section builders ---
    tech_rows = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;'>{k.replace('_',' ').title()}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>{v}</td></tr>"
        for k, v in info["tech_stack"].items()
    )

    arch_steps = "".join(f"<li style='margin-bottom:4px;'>{s}</li>" for s in info["architecture"]["flow"])

    # core features
    core_items = "".join(
        f"<li style='margin-bottom:8px;'><strong>{f['name']}</strong> — {f['description']}</li>"
        for f in info["features"]["core"]
    )

    # AI features (detailed cards)
    ai_cards = ""
    for feat in info["features"]["ai_powered"]:
        steps_html = "".join(f"<li>{s}</li>" for s in feat.get("how_to_use", []))
        examples_html = ""
        if feat.get("example_queries"):
            examples_html = "<p style='margin-top:8px;font-weight:600;font-size:0.85rem;'>Example queries:</p><ul style='margin:4px 0 0 18px;'>" + "".join(
                f"<li><code>{q}</code></li>" for q in feat["example_queries"]
            ) + "</ul>"
        if feat.get("example_input"):
            examples_html += f"<p style='margin-top:8px;font-weight:600;font-size:0.85rem;'>Example input:</p><p style='padding:8px 12px;background:#f1f5f9;border-radius:6px;font-style:italic;'>{feat['example_input']}</p>"

        rl = feat.get("rate_limit")
        rl_badge = _badge(rl, "#f59e0b") if rl else _badge("No limit", "#6b7280")

        ai_cards += f"""
        <details style="margin-bottom:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;" open>
            <summary style="padding:12px 16px;background:#f8fafc;cursor:pointer;font-weight:700;font-size:1rem;">
                {feat['name']} {rl_badge}
            </summary>
            <div style="padding:12px 16px;">
                <p style="margin:0 0 8px;">{feat['description']}</p>
                <p style="margin:4px 0;"><strong>Endpoint:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">{feat['endpoint']}</code></p>
                <p style="margin:4px 0;"><strong>Model:</strong> {feat['model']}</p>
                <p style="margin:10px 0 4px;font-weight:600;">How to use:</p>
                <ol style="margin:0 0 0 18px;">{steps_html}</ol>
                {examples_html}
            </div>
        </details>"""

    # librarian tools
    lib_items = "".join(
        f"<li style='margin-bottom:8px;'><strong>{f['name']}</strong> — {f['description']}</li>"
        for f in info["features"]["librarian_tools"]
    )

    # endpoints table
    endpoint_rows = ""
    for ep in info["endpoints"]:
        mc = _method_color(ep["method"])
        rl = ep.get("rate_limit", "")
        rl_cell = f"<td style='padding:6px 10px;border-bottom:1px solid #e5e7eb;'>{_badge(rl, '#f59e0b') if rl else '—'}</td>"
        endpoint_rows += (
            f"<tr>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #e5e7eb;'>"
            f"<span style='display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;color:#fff;background:{mc};'>{ep['method']}</span></td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:0.85rem;'>{ep['path']}</td>"
            f"<td style='padding:6px 10px;border-bottom:1px solid #e5e7eb;'>{ep['auth']}</td>"
            f"{rl_cell}"
            f"<td style='padding:6px 10px;border-bottom:1px solid #e5e7eb;'>{ep['purpose']}</td>"
            f"</tr>"
        )

    # rate limits
    rl_rows = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;'>{r['feature']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:0.85rem;'>{r['endpoint']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>{r['limit']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #e5e7eb;'>{r['type']}</td></tr>"
        for r in info["rate_limits"]
    )

    # walkthrough
    reader_steps = "".join(f"<li style='margin-bottom:4px;'>{s}</li>" for s in info["walkthrough"]["reader_flow"])
    librarian_steps = "".join(f"<li style='margin-bottom:4px;'>{s}</li>" for s in info["walkthrough"]["librarian_flow"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{info['name']} — Documentation</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; background: #f8fafc; line-height: 1.6; }}
  .container {{ max-width: 960px; margin: 0 auto; padding: 32px 24px; }}
  h1 {{ font-size: 2rem; margin-bottom: 4px; color: #0f172a; }}
  .tagline {{ color: #64748b; font-size: 1.05rem; margin-bottom: 24px; }}
  .version {{ display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; color: #fff; background: #6366f1; margin-left: 8px; vertical-align: middle; }}
  h2 {{ font-size: 1.4rem; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; color: #0f172a; }}
  h3 {{ font-size: 1.1rem; margin: 20px 0 8px; color: #334155; }}
  table {{ width: 100%; border-collapse: collapse; margin: 8px 0 16px; }}
  th {{ text-align: left; padding: 8px 12px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }}
  code {{ background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }}
  ul, ol {{ margin-left: 20px; }}
  a {{ color: #6366f1; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  nav {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }}
  nav ul {{ list-style: none; margin: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; }}
  nav a {{ font-weight: 500; font-size: 0.95rem; }}
  .badge-row {{ display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 20px; }}
  .badge-row img {{ height: 22px; }}
  details summary {{ user-select: none; }}
  details summary::-webkit-details-marker {{ color: #6366f1; }}
</style>
</head>
<body>
<div class="container">

<h1>{info['name']} <span class="version">v{info['version']}</span></h1>
<p class="tagline">{info['description']}</p>

<div class="badge-row">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/Supabase-Auth+Postgres-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google&logoColor=white" alt="Gemini">
  <img src="https://img.shields.io/badge/pgvector-Vector_Search-8B5CF6" alt="pgvector">
</div>

<nav>
  <ul>
    <li><a href="#tech-stack">Tech Stack</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li><a href="#core-features">Core Features</a></li>
    <li><a href="#ai-features">AI Features</a></li>
    <li><a href="#librarian-tools">Librarian Tools</a></li>
    <li><a href="#endpoints">All Endpoints</a></li>
    <li><a href="#rate-limits">Rate Limits</a></li>
    <li><a href="#walkthrough">Walkthrough</a></li>
  </ul>
</nav>

<h2 id="tech-stack">Tech Stack</h2>
<table>
  <thead><tr><th>Layer</th><th>Technology</th></tr></thead>
  <tbody>{tech_rows}</tbody>
</table>

<h2 id="architecture">Architecture</h2>
<p style="margin-bottom:10px;">{info['architecture']['summary']}</p>
<ol style="margin-left:20px;">{arch_steps}</ol>

<h2 id="core-features">Core Features</h2>
<ul>{core_items}</ul>

<h2 id="ai-features">AI-Powered Features</h2>
<p style="margin-bottom:12px;color:#64748b;">Click each card to expand full details, usage instructions, and examples.</p>
{ai_cards}

<h2 id="librarian-tools">Librarian Tools</h2>
<ul>{lib_items}</ul>

<h2 id="endpoints">All Endpoints ({len(info['endpoints'])})</h2>
<p style="margin-bottom:8px;color:#64748b;">All endpoints require Bearer auth unless Auth column says "None".</p>
<div style="overflow-x:auto;">
<table>
  <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Rate Limit</th><th>Purpose</th></tr></thead>
  <tbody>{endpoint_rows}</tbody>
</table>
</div>

<h2 id="rate-limits">Rate Limits</h2>
<table>
  <thead><tr><th>Feature</th><th>Endpoint</th><th>Limit</th><th>Implementation</th></tr></thead>
  <tbody>{rl_rows}</tbody>
</table>

<h2 id="walkthrough">Feature Walkthrough</h2>

<h3>Reader Flow</h3>
<ol style="margin-bottom:16px;">{reader_steps}</ol>

<h3>Librarian Flow</h3>
<ol>{librarian_steps}</ol>

<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:0.85rem;text-align:center;">
  {info['name']} v{info['version']} &mdash; Generated documentation &mdash;
    <a href="/docs">Swagger UI</a> &middot; <a href="/info">JSON</a>
</div>

</div>
</body>
</html>"""


@app.get("/info", response_class=HTMLResponse, include_in_schema=True,
         summary="Full feature & API documentation",
         description="Returns comprehensive documentation. Use ?format=html for a styled HTML page, or ?format=json (default) for structured JSON.")
async def info(format: Annotated[str, Query(pattern="^(json|html)$")] = "json"):
    """
    Full documentation endpoint.

    - **format=json** (default): structured JSON with all features, endpoints, AI details
    - **format=html**: self-contained styled HTML documentation page
    """
    data = _build_info()
    if format == "html":
        return HTMLResponse(content=_render_html(data))
    # For JSON, return plain dict (FastAPI auto-serializes to JSON)
    from fastapi.responses import JSONResponse
    return JSONResponse(content=data)
