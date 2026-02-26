# Milestone 2 — Core Features: Borrow Flow, Search & Dashboard

## Context

You are building a **Mini Library Management System**. This is Milestone 2 of 3.
**MS1 is already implemented**: project scaffolding, Supabase setup (all 3 tables, RLS, pgvector), Google OAuth auth, and Librarian Book CRUD are complete.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Python / FastAPI |
| Auth | Supabase Auth (SSO via Google OAuth) |
| Database | Supabase PostgreSQL + pgvector |
| AI | LangChain + OpenAI Embeddings + Google Books API *(MS3)* |
| Deployment | Vercel (frontend) · Render free tier (backend) · Supabase (DB) |

## User Roles

**Librarian**
- Full CRUD on all books *(done in MS1)*
- View all readers and their full borrow history
- Trigger AI-powered personalized book recommendations for any reader *(MS3)*
- Approve reader return requests before books are marked as returned
- View dashboard: total books, currently checked out, overdue, pending returns

**Reader**
- Browse and search the catalog
- Check out books (self-service) and request returns (librarian-approved)
- View their own borrow history
- See AI-generated similar book recommendations on any book detail page *(MS3)*
- Cannot access other readers' data or librarian tools

## Data Models (already in DB from MS1)

```sql
users: id (UUID), email, role ('librarian' | 'reader'), name, avatar_url, created_at
books: id (UUID), title, author, isbn, genre, description, cover_url, published_year, total_copies, available_copies, status ('available' | 'checked_out' | 'unavailable'), embedding (vector), created_at
borrow_records: id (UUID), user_id, book_id, borrowed_at, due_date, returned_at, status ('active' | 'returned' | 'overdue' | 'pending_return'), created_at
```

## Auth (already working from MS1)
- Google OAuth via Supabase Auth
- Role-based access: middleware checks session + role
- FastAPI dependency verifies Supabase JWT

## Tasks for This Milestone

### 1. Check-Out Flow (Reader Self-Service)
- [x] **Backend endpoint:** `POST /api/borrow`
  - Accepts `{ book_id }` + authenticated user from JWT
  - Validates: book exists, `available_copies > 0`, user doesn't already have an active borrow for this book
  - Creates `borrow_records` row: `status = 'active'`, `due_date = now() + 14 days`
  - Decrements `books.available_copies` by 1
  - If `available_copies` reaches 0, set `books.status = 'checked_out'`
  - Returns the borrow record
- [x] **Frontend:** "Borrow" button on book detail page (`/books/[id]`)
  - Only shown to readers when `available_copies > 0`
  - Disabled if user already has an active borrow for this book
  - On success: show confirmation, refresh book data

### 2. Return Flow (Librarian-Approved)
- [x] **Backend endpoint:** `POST /api/borrow/return` (reader requests return)
  - Accepts `{ borrow_record_id }` + authenticated user from JWT
  - Validates: borrow record exists and belongs to user, status is 'active' or 'overdue'
  - Sets borrow record `status = 'pending_return'` (does NOT set `returned_at`, does NOT touch `available_copies`)
  - Returns the updated borrow record
- [x] **Backend endpoint:** `POST /api/librarian/approve-return` (librarian approves)
  - Accepts `{ borrow_record_id }` + authenticated librarian from JWT
  - Validates: borrow record exists and `status == 'pending_return'`
  - Sets `returned_at = now()`, `status = 'returned'`
  - Increments `books.available_copies` by 1; if book was `checked_out`, set `status = 'available'`
- [x] **Backend endpoint:** `GET /api/librarian/pending-returns` (librarian only)
  - Returns all borrow records where `status == 'pending_return'` with book + user info
- [x] **Frontend (reader):** "Return" button in borrow history
  - Only shown for active/overdue borrows
  - On click: status changes to `pending_return`, button replaced with "Pending Approval" label
- [x] **Frontend (librarian):** Pending Returns section on dashboard
  - Shows all pending return requests with book/reader info and "Approve Return" button
  - On approve: record becomes `returned`, stats refresh
- [x] **Frontend (book detail):** Shows "Return pending approval" when reader has a `pending_return` borrow

### 3. Overdue Detection
- [x] **Backend:** Create a utility function or scheduled check
  - Query all `borrow_records` where `status = 'active'` AND `due_date < now()`
  - Update their status to `'overdue'`
  - Option A: Run on every relevant API call (simple)
  - Option B: Background task or cron (stretch)
- [x] **Backend endpoint:** `GET /api/borrow/overdue` (librarian only)
  - Returns all overdue borrow records with book + user info
- [x] **Frontend:** Overdue badge on librarian dashboard

### 4. Search & Browse
- [x] **Backend endpoint:** `GET /api/books/search`
  - Query params: `q` (search term), `genre`, `status`, `page`, `limit`
  - Search across `title`, `author`, `genre`, `isbn` using `ILIKE`
  - Filter by `status` (available, checked_out, unavailable)
  - Return paginated results with total count
- [x] **Frontend:** Search bar + filter controls on `/books` page
  - Text input for search query
  - Dropdown/chips for genre filter
  - Dropdown for availability status filter
  - Pagination controls (prev/next, page numbers)
  - Display results as a card grid with cover, title, author, status badge

### 5. Reader Borrow History
- [x] **Backend endpoint:** `GET /api/borrow/history`
  - Returns current user's borrow records (all statuses)
  - Include book details (title, author, cover_url)
  - Sorted by `borrowed_at` descending
- [x] **Frontend page:** `/reader/history`
  - Table or card list showing: book title, borrowed date, due date, returned date, status badge
  - "Return" button for active/overdue records

### 6. Librarian Dashboard
- [x] **Backend endpoint:** `GET /api/librarian/dashboard`
  - Returns: total books, total checked out, total overdue, total readers
- [x] **Backend endpoint:** `GET /api/librarian/readers`
  - Returns list of all readers with borrow counts
- [x] **Backend endpoint:** `GET /api/librarian/readers/{user_id}/history`
  - Returns full borrow history for a specific reader
- [x] **Frontend page:** `/librarian/dashboard`
  - Stats cards: Total Books, Checked Out, Overdue, Pending Returns, Total Readers
  - Pending returns list with reader info and Approve button
  - Overdue books list with reader info and days overdue
  - Readers list with link to view individual history
- [x] **Frontend page:** `/librarian/readers/[id]`
  - Reader profile info + full borrow history table

### 7. Onboarding / Role-Selection Flow (Post-MS2 Addition)

**Problem:** New users signing in via Google OAuth had no way to choose their role. The backend's `get_current_user` dependency auto-created every new user as a `reader`, making the role choice meaningless.

**Solution:**

- [x] **Frontend page:** `/onboarding`
  - Shows after first Google sign-in, before accessing any protected route
  - User picks "Reader" or "Librarian" role
  - Calls `POST /api/auth/setup` with chosen role to create the profile
  - Redirects to `/books` on success (full page reload to pick up new profile)
- [x] **Backend fix:** `get_current_user` (`backend/app/core/auth.py`)
  - Removed silent auto-creation of `reader` profiles
  - Now returns 403 `"profile_setup_required"` if no profile exists in `users` table
  - `POST /api/auth/setup` is the **only** way to create a user profile
- [x] **Middleware guard:** `frontend/src/lib/supabase/middleware.ts`
  - Added `/onboarding` to `protectedPaths` (unauthenticated users redirected to `/login`)
  - Authenticated user + no profile → redirected to `/onboarding`
  - Authenticated user + has profile + on `/onboarding` → redirected to `/books`
  - Librarian route guard consolidated into the same single profile query

**Files changed:**
- `backend/app/core/auth.py` — removed auto-creation, raises 403 for missing profile
- `frontend/src/lib/supabase/middleware.ts` — onboarding guard + consolidated profile query
- `frontend/src/app/onboarding/page.tsx` — role selection UI

## Acceptance Criteria

- [x] Reader can borrow a book from the book detail page
- [x] Reader can request a return from their borrow history (status → `pending_return`)
- [x] Librarian can approve pending returns from the dashboard (status → `returned`, `available_copies` incremented)
- [x] `available_copies` only changes on borrow (decrement) and librarian approval (increment) — not on reader return request
- [x] Reader cannot re-borrow a book while a return is pending
- [x] Overdue records are flagged and visible on librarian dashboard
- [x] Search works across title, author, genre, ISBN with filters
- [x] Pagination works correctly
- [x] Reader can view their own borrow history
- [x] Librarian dashboard shows stats (incl. pending returns) + pending returns list + overdue list + reader list
- [x] Librarian can view any reader's full borrow history
- [x] Readers cannot access librarian dashboard or other readers' data
- [x] New users are prompted to choose Reader or Librarian role on first sign-in
- [x] No API call can silently create a user profile — only `POST /api/auth/setup` does
- [x] Users without a profile are redirected to `/onboarding` on all protected routes
- [x] Users with a profile skip `/onboarding` automatically
