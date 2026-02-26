# Milestone 3 — AI Features: Recommendations

## Context

You are building a **Mini Library Management System**. This is Milestone 3 of 3.
**MS1 is already implemented**: project scaffolding, Supabase setup (all 3 tables, RLS, pgvector), Google OAuth auth, and Librarian Book CRUD.
**MS2 is already implemented**: check-in/check-out flow with librarian-approved returns (two-phase: reader requests → librarian approves), overdue detection, catalog search + filters + pagination, librarian dashboard (with pending returns section), reader borrow history, onboarding/role-selection flow (new users choose Reader or Librarian on first sign-in; `get_current_user` no longer auto-creates profiles — returns 403 `"profile_setup_required"` instead).

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Python / FastAPI |
| Auth | Supabase Auth (SSO via Google OAuth) |
| Database | Supabase PostgreSQL + pgvector |
| AI | LangChain + OpenAI Embeddings + Google Books API |
| Deployment | Vercel (frontend) · Render free tier (backend) · Supabase (DB) |

## User Roles

**Librarian**
- Full CRUD on all books *(MS1)*
- View all readers and their full borrow history *(MS2)*
- **Trigger AI-powered personalized book recommendations for any reader** ← this milestone
- Approve reader return requests before books are marked as returned *(MS2)*
- View dashboard: total books, currently checked out, overdue, pending returns *(MS2)*

**Reader**
- Browse and search the catalog *(MS2)*
- Check out books (self-service) and request returns (librarian-approved) *(MS2)*
- View their own borrow history *(MS2)*
- **See AI-generated similar book recommendations on any book detail page** ← this milestone
- Cannot access other readers' data or librarian tools

## Data Models (already in DB)

```sql
users: id (UUID), email, role ('librarian' | 'reader'), name, avatar_url, created_at
books: id (UUID), title, author, isbn, genre, description, cover_url, published_year, total_copies, available_copies, status, embedding (vector(1536)), created_at
borrow_records: id (UUID), user_id, book_id, borrowed_at, due_date, returned_at, status, created_at
```

Key column for this milestone: `books.embedding` — a `vector(1536)` column (pgvector) that will store OpenAI `text-embedding-3-small` embeddings of each book's description.

## Additional Table for This Milestone

```sql
-- Cache for Google Books API results
CREATE TABLE public.google_books_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  similar_books JSONB NOT NULL,  -- array of {title, author, cover_url, google_books_url}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id)
);

ALTER TABLE public.google_books_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cache is viewable by authenticated users" ON public.google_books_cache
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Backend can manage cache" ON public.google_books_cache
  FOR ALL USING (true);  -- backend uses service_role key
```

## Tasks for This Milestone

### 1. Similar Book Recommendations (Reader-Facing via Google Books API)

**Where:** Book detail page (`/books/[id]`) — "You might also like" section

**How it works:**
1. When a reader opens a book detail page, the frontend calls the backend
2. Backend checks `google_books_cache` for this book — if cached, return immediately
3. If not cached, call Google Books API: `GET https://www.googleapis.com/books/v1/volumes?q={title}+{author}+{genre}&maxResults=5`
4. Parse the response: extract `title`, `authors`, `thumbnail`, `infoLink` for each result
5. Filter out the current book itself from results
6. Store the parsed results in `google_books_cache`
7. Return top 5 similar books to the frontend

**Implementation:**

- [x] **Backend endpoint:** `GET /api/books/{id}/similar`
  - Uses pgvector cosine similarity via `find_similar_books` RPC (migration 004)
  - Falls back to generating embedding on-the-fly if book has none
  - Return: `[{ id, title, author, cover_url, similarity }]`
- [x] **Backend:** Google Books API client utility
  - Build query string from book's title + author + genre
  - Handle rate limits and errors gracefully (httpx timeout + error handling)
  - Parse Google Books API response format
- [x] **Frontend component:** `SimilarBooks` on `/books/[id]` page
  - Show loading skeleton while fetching
  - Display up to 5 books in a horizontal card row
  - Each card: cover image, title, author, similarity percentage
  - Handle empty state ("No similar books found")

### 2. Generate & Store Book Embeddings

**Purpose:** Power the personalized recommendation engine (Task 3 below).

**How it works:**
- For each book in the library, generate an embedding of its description using OpenAI `text-embedding-3-small` via LangChain
- Store the embedding in the `books.embedding` column (pgvector `vector(1536)`)
- Run this as a one-time batch job + on every new book creation

**Implementation:**

- [x] **Backend:** Install dependencies: `langchain`, `langchain-google-genai`, `numpy`
- [x] **Backend utility:** `generate_embedding(text: str) -> list[float]`
  - Uses LangChain's `GoogleGenerativeAIEmbeddings(model="gemini-embedding-001")`
  - Input: book description (or fallback to `title + author + genre` if no description)
  - Return: 768-dimensional vector (migration 003 updated column from 1536 → 768)
- [x] **Backend endpoint:** `POST /api/books/generate-embeddings` (librarian only)
  - Batch job: query all books where `embedding IS NULL`
  - For each book, generate embedding and update the row
  - Return count of books processed
- [x] **Backend hook:** When a new book is created (in the existing `POST /api/books` endpoint), also generate and store its embedding
- [x] **Backend hook:** When a book is updated (in the existing `PUT /api/books/{id}` endpoint), regenerate its embedding if description/title/author/genre changed

### 3. Personalized Reader Recommendations (Librarian-Triggered)

**Where:** Librarian dashboard → select a reader → click "Recommend Books"

**How it works (the important part — build this right):**
1. Pull the reader's full borrow history from `borrow_records` (all statuses)
2. Get the `embedding` vector for each borrowed book from `books` table
3. Filter out any books that don't have embeddings yet
4. Compute the **average embedding** across all borrowed books → this is the reader's "taste profile"
5. Run a **cosine similarity search** via pgvector:
   ```sql
   SELECT id, title, author, genre, cover_url,
          1 - (embedding <=> $taste_profile_vector) AS similarity
   FROM books
   WHERE id NOT IN (SELECT book_id FROM borrow_records WHERE user_id = $reader_id)
     AND embedding IS NOT NULL
     AND available_copies > 0
   ORDER BY embedding <=> $taste_profile_vector
   LIMIT 5;
   ```
6. Return the top 5 most similar books the reader hasn't borrowed

**Tech chain:** LangChain → OpenAI Embeddings → pgvector similarity search.
**No LangGraph needed** — this is a single-step retrieval, not an agentic workflow.

**Implementation:**

- [x] **Backend endpoint:** `GET /api/librarian/readers/{user_id}/recommendations` (librarian only)
  - Validate: user is librarian, target user exists
  - Pull reader's borrow history
  - Get embeddings for borrowed books
  - Compute average embedding vector (numpy)
  - Execute pgvector cosine similarity query via `recommend_books_for_reader` RPC
  - Return top 5 recommended books with similarity scores
- [x] **Backend:** Handle edge cases:
  - Reader has no borrow history → return message "No borrow history to base recommendations on."
  - No borrowed books have embeddings → return message "No embeddings available... Please generate embeddings first."
  - All books already borrowed → return message "No recommendations found. The reader may have borrowed all available books."
- [x] **Frontend component:** On `/librarian/readers/[id]` page
  - "Recommend Books" button
  - On click: loading state (skeleton cards), then display recommended books
  - Each recommendation: cover, title, author, genre, similarity score (as percentage)
  - Handle empty/error states + "Send via Email" button

### 4. Stretch Goals (Optional)

- [x] **Bulk CSV Import:** Librarian can upload a CSV file to add multiple books at once
  - `POST /api/books/import-csv` — parse CSV, validate rows, insert books, generate embeddings
  - Frontend: file upload form on librarian dashboard page
- [x] **Return Approval Workflow:** *(implemented in MS2)* Reader requests return → librarian approves
  - New status on borrow_records: `'pending_return'`
  - `POST /api/borrow/return` sets status to `'pending_return'`
  - `POST /api/librarian/approve-return` completes the return
  - `GET /api/librarian/pending-returns` lists pending requests
  - Pending Returns section on librarian dashboard with Approve buttons
- [x] **Checkout Approval Workflow:** Reader requests checkout, librarian approves/rejects
  - New status on borrow_records: `'pending'` (migration 005 updates CHECK constraint)
  - `POST /api/borrow` creates with status `'pending'`
  - `POST /api/librarian/borrow/{id}/approve` and `/reject` endpoints
  - Pending Checkouts section on librarian dashboard with Approve/Reject buttons
- [x] **Email Notifications via Resend:**
  - `POST /api/librarian/readers/{user_id}/send-recommendations` sends personalized recs via email
  - `send_overdue_reminder()` utility for overdue reminders
  - Uses Resend API with HTML email templates

## Acceptance Criteria

- [x] Book detail page shows "You might also like" section with up to 5 similar books (pgvector cosine similarity)
- [x] Google Books API client utility implemented for external book lookups
- [x] All books in the library have embeddings generated and stored in pgvector (768d via Google Gemini)
- [x] New/updated books automatically get embeddings
- [x] Librarian can click "Recommend Books" for any reader and see personalized results
- [x] Recommendations are based on cosine similarity of the reader's taste profile vs. available books
- [x] Recommendations exclude books the reader has already borrowed
- [x] Edge cases are handled gracefully (no history, no embeddings, all borrowed)
- [x] No LangGraph — only LangChain + Google Gemini Embeddings + pgvector
- [x] Bulk CSV import with validation and auto-embedding generation
- [x] Checkout approval workflow (pending → approve/reject)
- [x] Email notifications via Resend (recommendations + overdue reminders)
- [x] `find_similar_books` RPC function created (migration 004)
- [x] `borrow_records` status constraint updated for pending/pending_return (migration 005)
