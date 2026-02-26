# Aspire Library App

Production-ready full-stack library management app with role-based workflows (Reader/Librarian), AI-powered search/discovery, and personalized recommendations.

## What This App Includes

- Google OAuth sign-in via Supabase Auth
- Role-based onboarding (`reader` or `librarian`)
- Catalog browsing, classic search, and AI smart search
- Borrow flow with librarian approval + return approval
- Librarian dashboard (stats, pending checkouts, overdue, pending returns)
- AI features:
  - Similar books (pgvector)
  - Reader recommendations (pgvector taste profile)
  - AI book summaries (Gemini + cache)
  - AI discovery from natural-language paragraph (Gemini + Google/Open Library)
- Book request workflow (reader request + librarian approve/reject/fulfill)
- CSV import and embedding generation tools for librarians

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | FastAPI, Pydantic, Uvicorn |
| Auth & DB | Supabase Auth + Postgres |
| Vector Search | `pgvector` |
| AI | LangChain + Gemini (`langchain-google-genai`) |
| External Data | Google Books API + Open Library fallback |
| Email | Resend (optional) |

## Architecture

1. Frontend (Next.js) authenticates users with Supabase.
2. Frontend calls FastAPI endpoints with Bearer token.
3. Backend validates token and authorizes by role.
4. Backend reads/writes Supabase using service-role credentials.
5. AI/search flows use Gemini + vector RPCs + optional external book APIs.

## Quick Start (Local)

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Supabase project
- A Google API key (Gemini + Google Books usage)

### 1) Configure Supabase

Run migrations in this order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_recommendation_rpc.sql`
3. `supabase/migrations/003_vector_768.sql`
4. `supabase/migrations/004_find_similar_books_rpc.sql`
5. `supabase/migrations/005_borrow_status_pending.sql`

Optional sample data:

- `supabase/seed_books.sql`

Enable Google OAuth in Supabase:

- Auth → Providers → Google: enabled
- Redirect URL: `http://localhost:3000/auth/callback`

### 2) Configure Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set values in `backend/.env`:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Backend privileged access |
| `FRONTEND_URL` | Yes (prod) | CORS allowed frontend origin |
| `GOOGLE_API_KEY` | Recommended | Gemini + Google Books |
| `RESEND_API_KEY` | Optional | Send recommendation email |

Run backend:

```bash
uvicorn app.main:app --reload --port 8000
```

### 3) Configure Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Set values in `frontend/.env.local`:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI base URL (default `http://localhost:8000`) |

Run frontend:

```bash
npm run dev
```

### 4) Promote a Librarian

After first login, promote your account in Supabase SQL editor:

```sql
UPDATE public.users
SET role = 'librarian'
WHERE email = 'your-email@example.com';
```

## Try It Fast (Feature Walkthrough)

Use these flows to quickly verify the whole app.

### Reader Flow

1. Sign in with Google and choose `Reader` during onboarding.
2. Open `/books`:
	- Use **AI mode** search with prompts like:
	  - `hobbits on an adventure`
	  - `sand desert and a messiah`
	  - `dark political sci-fi with philosophical themes`
	  - `cozy mystery in a small town with amateur detective`
	- Switch to **Classic** mode to compare keyword results.
3. Open any book detail (`/books/{id}`):
	- Try **Borrow this Book** (status becomes pending until librarian approval).
	- Use **AI Summary**.
	- Check **Similar Books** recommendations.
4. Open `/reader/history`:
	- Confirm pending/active/overdue/pending_return statuses.
	- Request a return from history.
5. Open `/reader/discover`:
	- Paste a paragraph-style request and discover new books.
	- Example: `I want an epic fantasy about unlikely companions crossing dangerous lands with loyalty, humor, and a dark enemy rising.`
	- Request missing books directly from discovery results.
6. Open `/reader/requests`:
	- Track request status (`pending`, `approved`, `rejected`, `fulfilled`).

### Librarian Flow

1. Open `/librarian/dashboard`.
2. Approve/reject pending checkout requests.
3. Approve pending returns.
4. Review reader book requests and approve/reject with optional note.
5. Generate embeddings (required for stronger AI recommendations).
6. Import books via CSV.
7. Open reader profile (`/librarian/readers/{userId}`):
	- View history
	- Generate personalized recommendations
	- Send recommendation email (if `RESEND_API_KEY` is configured)

## API Catalog

All endpoints require Bearer auth unless stated.

### Auth

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/auth/me` | Any authenticated | Current profile |
| POST | `/api/auth/setup` | Any authenticated | Create initial user profile with role |

### Books, Search, AI

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/books` | Any | Paginated catalog |
| GET | `/api/books/{book_id}` | Any | Book detail |
| POST | `/api/books` | Librarian | Create book |
| PUT | `/api/books/{book_id}` | Librarian | Update book |
| DELETE | `/api/books/{book_id}` | Librarian | Delete book |
| GET | `/api/books/search` | Any | Classic keyword search |
| GET | `/api/books/smart-search` | Any | AI hybrid semantic + keyword search |
| GET | `/api/books/{book_id}/similar` | Any | Similar books by embeddings |
| GET | `/api/books/{book_id}/summary` | Any | AI summary (cached) |
| POST | `/api/books/discover` | Any | Paragraph-based AI discovery |
| POST | `/api/books/generate-embeddings` | Librarian | Batch-generate missing embeddings |
| POST | `/api/books/import-csv` | Librarian | Bulk import books |

### Borrowing

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/borrow` | Any | Create pending checkout request |
| POST | `/api/borrow/return` | Any | Create pending return request |
| GET | `/api/borrow/history` | Any | Current user borrow history |
| GET | `/api/borrow/overdue` | Librarian | Overdue records |

### Librarian Operations

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/librarian/dashboard` | Librarian | Dashboard metrics |
| GET | `/api/librarian/readers` | Librarian | Reader list + counts |
| GET | `/api/librarian/readers/{user_id}` | Librarian | Reader profile |
| GET | `/api/librarian/readers/{user_id}/history` | Librarian | Reader borrow history |
| GET | `/api/librarian/pending-checkouts` | Librarian | Pending borrow approvals |
| POST | `/api/librarian/borrow/{borrow_id}/approve` | Librarian | Approve checkout |
| POST | `/api/librarian/borrow/{borrow_id}/reject` | Librarian | Reject checkout |
| GET | `/api/librarian/pending-returns` | Librarian | Pending return approvals |
| POST | `/api/librarian/approve-return` | Librarian | Approve return |
| GET | `/api/librarian/readers/{user_id}/recommendations` | Librarian | Personalized recommendations |
| POST | `/api/librarian/readers/{user_id}/send-recommendations` | Librarian | Email recommendations |

### Book Requests

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/book-requests` | Any | Create request |
| GET | `/api/book-requests` | Any | My requests |
| GET | `/api/librarian/book-requests` | Librarian | All requests (optional status filter) |
| POST | `/api/librarian/book-requests/{request_id}/review` | Librarian | Approve/reject request |

## Production Deployment

You can deploy with multiple providers. A common setup:

- Frontend: Vercel
- Backend: Render / Railway / Fly.io
- Database/Auth: Supabase

### Production Checklist

- Set production frontend URL in backend `FRONTEND_URL`.
- Set production `NEXT_PUBLIC_API_URL` in frontend.
- Configure Supabase OAuth redirect to production callback URL.
- Store secrets only in provider secret managers (never in repo).
- Enforce HTTPS on frontend and backend domains.
- Use process-level scaling awareness: current in-memory rate limiter is per-instance.
- Ensure AI-dependent features have `GOOGLE_API_KEY` configured.

## Known Schema/Infra Notes

The backend currently uses additional DB objects beyond migrations `001-005`:

- `book_requests` table
- `book_summaries` table
- RPC function `find_similar_books_for_search(query_embedding vector(768), result_limit int)`

If these are missing in your database, related features will fail at runtime (book requests, AI summaries, smart semantic ranking). Add these objects before production release.

## Operational Notes

- Health check: `GET /health`
- Root endpoint: `GET /`
- Overdue marking currently runs during request flows (not via background scheduler)
- Recommendation quality improves after generating embeddings for catalog books

## Repository Notes

- Milestone/spec docs:
  - `1-foundation.md`
  - `2-core-features.md`
  - `3-advanced-ai.md`
  - `4-ai-features.md`
- Frontend-specific docs live in `frontend/README.md` (short pointer)
