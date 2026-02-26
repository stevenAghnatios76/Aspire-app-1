# Milestone 4 — Advanced AI: Smart Search, Book Discovery & AI Summaries

## Context

You are building a **Mini Library Management System**. This is Milestone 4.
**MS1 is already implemented**: project scaffolding, Supabase setup (all 3 tables, RLS, pgvector), Google OAuth auth, and Librarian Book CRUD.
**MS2 is already implemented**: check-in/check-out flow with librarian-approved returns, overdue detection, catalog search + filters + pagination, librarian dashboard, reader borrow history, onboarding/role-selection flow.
**MS3 is already implemented**: similar book recommendations (pgvector cosine similarity + Google Books API), Google Gemini embedding generation (768d), personalized reader recommendations (librarian-triggered), bulk CSV import, checkout approval workflow, email notifications via Resend.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Python / FastAPI |
| Auth | Supabase Auth (SSO via Google OAuth) |
| Database | Supabase PostgreSQL + pgvector |
| AI | LangChain + Google Gemini (embeddings + LLM) + Google Books API |
| LLM | Google Gemini 2.0 Flash via `langchain-google-genai` |
| Web Search | Google Custom Search API (or SerpAPI) for book discovery |
| Deployment | Vercel (frontend) · Render free tier (backend) · Supabase (DB) |

## New Dependencies

### Backend (`requirements.txt` additions)
```
langchain-google-genai>=2.0.0   # already installed — Gemini LLM + embeddings
google-api-python-client>=2.0.0 # Google Custom Search API
```

### Frontend (`package.json` additions)
```
# No new frontend dependencies — uses existing API client + UI components
```

### Environment Variables (`.env` additions)
```
GOOGLE_API_KEY=...                  # already set — reused for Gemini LLM
GOOGLE_CSE_ID=...                   # Google Custom Search Engine ID (new)
```

## New Data Models

```sql
-- Migration 006: Book requests table
CREATE TABLE public.book_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  cover_url TEXT,
  source_url TEXT,              -- link to the book on Google Books / external source
  description TEXT,
  reason TEXT,                  -- reader's reason for requesting
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  librarian_note TEXT,          -- librarian response / note
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.book_requests ENABLE ROW LEVEL SECURITY;

-- Readers can view their own requests, librarians can view all
CREATE POLICY "Users can view own book requests" ON public.book_requests
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );

CREATE POLICY "Users can insert own book requests" ON public.book_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Librarians can update book requests" ON public.book_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );


-- Migration 007: AI summaries cache table
CREATE TABLE public.book_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id)
);

ALTER TABLE public.book_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Summaries are viewable by authenticated users" ON public.book_summaries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Backend can manage summaries" ON public.book_summaries
  FOR ALL USING (true);  -- backend uses service_role key
```

## Config Update

```python
# backend/app/core/config.py — add these fields to Settings:
class Settings(BaseSettings):
    # ... existing fields ...
    google_cse_id: str = ""  # Google Custom Search Engine ID for book discovery
```

## Tasks for This Milestone

### 1. NLP-Powered Smart Search (AI Search Bar)

**Where:** Main search bar on `/books` page — replaces/augments the existing ILIKE-based search

**Problem:** The current search (`GET /api/books/search`) uses simple `ILIKE` matching against title, author, genre, and ISBN. It can't understand natural language queries like "a mystery novel set in Victorian England" or "something like Harry Potter but for adults" or "books about machine learning for beginners".

**How it works:**
1. User types a natural language query into the main search bar (e.g., "a thrilling sci-fi adventure on Mars")
2. Frontend sends the query to a new backend endpoint
3. Backend uses Google Gemini LLM to **interpret** the query and extract structured search intent:
   - Keywords, genres, themes, authors, time periods, moods
4. Backend generates an embedding of the user's query using the existing `generate_embedding()` function
5. Backend performs a **hybrid search**:
   - **Semantic search:** pgvector cosine similarity against `books.embedding` using the query embedding
   - **Keyword fallback:** traditional ILIKE search as a secondary signal
6. Results are ranked by semantic similarity, with keyword matches boosted
7. Return ranked results to the frontend

**Implementation:**

- [ ] **Backend service:** `backend/app/services/smart_search.py`
  - `interpret_query(query: str) -> dict` — uses Gemini LLM to extract search intent
    - Prompt: "Extract structured search parameters from this book search query. Return JSON with: keywords, genres, themes, mood, author_hint, era_hint."
    - Returns parsed intent for logging/debugging
  - `semantic_search(query: str, limit: int = 20) -> list[dict]`
    - Generate embedding of the query via `generate_embedding(query)`
    - Execute pgvector cosine similarity search:
      ```sql
      SELECT id, title, author, genre, description, cover_url, available_copies, status,
             1 - (embedding <=> $query_embedding) AS relevance
      FROM books
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $query_embedding
      LIMIT $limit;
      ```
    - Return results with relevance scores
  - `hybrid_search(query: str, genre: str, status: str, page: int, limit: int) -> dict`
    - Run semantic search for the query
    - Also run traditional ILIKE search
    - Merge & deduplicate results: semantic matches ranked first, keyword-only matches appended
    - Apply genre/status filters on the merged results
    - Return paginated results with `total`, `page`, `total_pages`

- [ ] **Backend endpoint:** `GET /api/books/smart-search`
  - Query params: `q` (natural language query), `genre`, `status`, `page`, `limit`
  - If `q` is empty, fall back to standard paginated listing (same as current behavior)
  - If `q` has fewer than 3 words AND looks like a simple keyword, fall back to ILIKE search for speed
  - Otherwise, run full hybrid search pipeline
  - Response matches existing `PaginatedBooks` schema (add `relevance` field to book items)
  - **Important:** Keep the existing `GET /api/books/search` endpoint working as-is for backward compatibility

- [ ] **Backend:** Add `smart_search` router to `main.py`
  - Register the new router BEFORE the books router (same pattern as existing search router)

- [ ] **Frontend:** Update `/books` page search bar
  - Add a toggle or auto-detect: "AI Search" mode vs. "Classic Search" mode
  - When AI Search is active:
    - Show a sparkle/AI icon in the search bar
    - Placeholder text: "Describe what you'd like to read..."
    - Debounce input (500ms) before sending to `smart-search` endpoint
    - Show relevance percentage badge on each result card
  - When Classic Search is active:
    - Keep current ILIKE-based search behavior exactly as-is
  - Default to AI Search mode; user can toggle to Classic if needed
  - Genre and status filters work with both modes

- [ ] **Schema update:** `backend/app/schemas/book.py`
  - Add optional `relevance: float | None` field to `BookOut` schema
  - Ensure `PaginatedBooks` can carry relevance scores


### 2. AI-Powered Book Discovery (Paragraph Search)

**Where:** New page `/reader/discover` — "Discover Books" section accessible from the navbar

**Problem:** A reader wants to find books but doesn't have a specific title or author in mind. They want to describe what they're in the mood for in a paragraph, and the system should find matching books from across the web — not just the library's catalog.

**How it works:**
1. Reader writes a free-form paragraph describing what they want to read
   - Example: "I just finished reading a dark fantasy series and I'm looking for something similar. I love morally grey characters, complex magic systems, and political intrigue. Preferably a completed series so I don't have to wait for new books."
2. Backend sends the paragraph to Google Gemini LLM to extract:
   - Key themes, genres, mood, preferred characteristics
   - A set of optimized search queries to find relevant books
3. Backend uses Google Custom Search API (or Google Books API) to search the web for matching books
4. Backend uses Gemini LLM to rank and filter the results for relevance to the original paragraph
5. Returns a curated list of book recommendations with:
   - Title, author, cover image, description, source URL
   - Whether the book **exists in the library catalog** (cross-reference by ISBN or title+author)
   - If it exists: show availability status and a "Borrow" link
   - If it doesn't exist: show a "Request This Book" button

**Implementation:**

- [ ] **Backend service:** `backend/app/services/book_discovery.py`
  - `extract_search_intent(paragraph: str) -> dict`
    - Uses Gemini LLM with prompt:
      ```
      You are a book recommendation expert. A reader described what they want to read:
      "{paragraph}"
      
      Extract the following as JSON:
      - themes: list of key themes
      - genres: list of genres
      - mood: overall mood (e.g., dark, uplifting, suspenseful)
      - characteristics: list of desired book characteristics
      - search_queries: list of 3-5 optimized Google search queries to find matching books
        (each query should be specific and include "book" or "novel" keyword)
      ```
    - Returns parsed intent object

  - `search_web_for_books(queries: list[str], max_results_per_query: int = 5) -> list[dict]`
    - For each query, call Google Custom Search API:
      `GET https://www.googleapis.com/customsearch/v1?q={query}&cx={CSE_ID}&key={API_KEY}&num=5`
    - Parse results to extract book information
    - Deduplicate results by title+author
    - Alternatively, use Google Books API as primary source:
      `GET https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=5`
    - Return raw results list

  - `rank_and_curate(paragraph: str, raw_books: list[dict]) -> list[dict]`
    - Send the raw results + original paragraph to Gemini LLM:
      ```
      The reader wants: "{paragraph}"
      
      Here are books found from web search:
      {raw_books_json}
      
      Rank these books by relevance to the reader's request. Return the top 10 as JSON array:
      [{ "title", "author", "description", "cover_url", "source_url", "relevance_reason" }]
      Only include books that genuinely match the reader's description.
      ```
    - Return curated list with relevance reasons

  - `cross_reference_catalog(books: list[dict]) -> list[dict]`
    - For each discovered book, check if it exists in the library:
      - Match by ISBN (if available)
      - Fallback: match by case-insensitive title + author similarity
    - Annotate each book with:
      - `in_catalog: bool`
      - `catalog_book_id: str | None`
      - `available_copies: int | None`
    - Return annotated list

  - `discover_books(paragraph: str) -> dict`
    - Orchestrator function: calls extract → search → rank → cross-reference
    - Returns `{ books: [...], intent: {...} }` 

- [ ] **Backend endpoint:** `POST /api/books/discover`
  - Body: `{ "paragraph": "..." }` + authenticated user from JWT
  - Validates: paragraph is not empty, min 20 characters, max 2000 characters
  - Calls `discover_books(paragraph)`
  - Returns: `{ books: [...], intent: {...}, total: int }`
  - Rate limit: max 10 discovery requests per user per hour (simple in-memory counter or DB check)

- [ ] **Backend schema:** `backend/app/schemas/discovery.py`
  ```python
  class DiscoveryRequest(BaseModel):
      paragraph: str = Field(..., min_length=20, max_length=2000)

  class DiscoveredBook(BaseModel):
      title: str
      author: str | None
      description: str | None
      cover_url: str | None
      source_url: str | None
      isbn: str | None
      relevance_reason: str | None
      in_catalog: bool = False
      catalog_book_id: str | None = None
      available_copies: int | None = None

  class DiscoveryResponse(BaseModel):
      books: list[DiscoveredBook]
      intent: dict
      total: int
  ```

- [ ] **Frontend page:** `/reader/discover`
  - Large text area with placeholder: "Tell us what kind of book you're looking for... Describe the themes, genres, mood, or anything else you'd like in your next read."
  - "Discover Books" button (disabled while loading)
  - Loading state: animated skeleton cards + "Our AI is searching the web for books you'll love..."
  - Results grid:
    - Book card: cover image, title, author, short description, relevance reason tag
    - **In catalog badge:** green "Available in Library" or yellow "Checked Out" badge
    - **Borrow link:** if in catalog and available, link to `/books/[catalog_book_id]`
    - **"Request This Book" button:** if NOT in catalog → opens request modal
  - Empty state: "No books found matching your description. Try being more specific or describing different themes."

- [ ] **Frontend:** Add "Discover" link to Navbar
  - Show for reader role only (between "Books" and "History" links)
  - Icon: sparkle or compass icon


### 3. Book Request System (Request Unavailable Books)

**Where:** Triggered from the Discover page "Request This Book" button + standalone page `/reader/requests`

**How it works:**
1. Reader finds a book via AI Discovery that isn't in the library catalog
2. Reader clicks "Request This Book" → modal pre-fills title, author, description from the discovered book
3. Reader can add a personal reason/note ("I'd love to read this for my book club")
4. Request is saved to `book_requests` table with status `'pending'`
5. Librarian sees pending book requests on their dashboard
6. Librarian can approve (adds book to catalog), reject (with a note), or mark as fulfilled

**Implementation:**

- [ ] **Backend endpoint:** `POST /api/book-requests` (reader)
  - Body: `{ title, author?, isbn?, cover_url?, source_url?, description?, reason? }`
  - Creates a `book_requests` row with `status = 'pending'`
  - Validates: title is required, no duplicate pending requests for same title+author by same user
  - Returns the created request

- [ ] **Backend endpoint:** `GET /api/book-requests` (reader — own requests only)
  - Returns current user's book requests, sorted by `created_at` descending
  - Include status, librarian note if reviewed

- [ ] **Backend endpoint:** `GET /api/librarian/book-requests` (librarian only)
  - Query params: `status` (filter by pending/approved/rejected/fulfilled), `page`, `limit`
  - Returns all book requests with requester info (name, email)
  - Sorted by `created_at` descending

- [ ] **Backend endpoint:** `POST /api/librarian/book-requests/{id}/review` (librarian only)
  - Body: `{ action: 'approve' | 'reject', note?: string }`
  - Updates `status`, `librarian_note`, `reviewed_by`, `reviewed_at`
  - If approved: optionally auto-create the book in the catalog (using title, author, description, cover_url from the request)
  - Returns updated request

- [ ] **Backend schema:** `backend/app/schemas/book_request.py`
  ```python
  class BookRequestCreate(BaseModel):
      title: str
      author: str | None = None
      isbn: str | None = None
      cover_url: str | None = None
      source_url: str | None = None
      description: str | None = None
      reason: str | None = None

  class BookRequestOut(BaseModel):
      id: str
      user_id: str
      title: str
      author: str | None
      isbn: str | None
      cover_url: str | None
      source_url: str | None
      description: str | None
      reason: str | None
      status: str
      librarian_note: str | None
      reviewed_by: str | None
      reviewed_at: str | None
      created_at: str
      # Joined fields (from user)
      requester_name: str | None = None
      requester_email: str | None = None

  class BookRequestReview(BaseModel):
      action: Literal['approve', 'reject']
      note: str | None = None
  ```

- [ ] **Frontend:** Request modal component (`BookRequestModal`)
  - Pre-filled form: title, author, description (from discovered book)
  - Editable "reason" text area
  - Submit → calls `POST /api/book-requests`
  - Success toast: "Your book request has been submitted! The librarian will review it."

- [ ] **Frontend page:** `/reader/requests`
  - Lists the reader's book requests with status badges:
    - 🟡 Pending — "Under review"
    - 🟢 Approved — "The librarian has approved your request!"
    - 🔴 Rejected — "Not available at this time" + librarian note
    - 🔵 Fulfilled — "This book has been added to the library!" + link to the book
  - Add "My Requests" link to reader navbar

- [ ] **Frontend:** Librarian dashboard — Book Requests section
  - New tab/section: "Book Requests" showing pending requests count
  - List pending requests with requester info, book title/author, reason
  - "Approve" and "Reject" buttons with optional note input
  - On approve: prompt librarian to also add the book to catalog (pre-filled form)


### 4. AI Book Summary Generation

**Where:** Button on every book card and book detail page — "Generate AI Summary"

**Problem:** Book descriptions in the catalog may be long, missing, or unhelpful. Readers want a quick, engaging summary to decide if they want to read a book.

**How it works:**
1. User clicks "AI Summary" button next to any book
2. Backend checks `book_summaries` cache — if cached, return immediately
3. If not cached, send the book's metadata (title, author, genre, description) to Gemini LLM
4. Gemini generates a concise, engaging 3-4 sentence summary
5. Cache the summary in `book_summaries` table
6. Return summary to frontend and display inline

**Implementation:**

- [ ] **Backend service:** `backend/app/services/book_summary.py`
  - `generate_book_summary(book: dict) -> str`
    - Uses Google Gemini LLM via LangChain:
      ```python
      from langchain_google_genai import ChatGoogleGenerativeAI
      
      llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=...)
      
      prompt = f"""
      Generate a concise, engaging summary for this book in 3-4 sentences.
      The summary should help a reader decide if they want to read this book.
      Do not include spoilers. Focus on the premise, themes, and what makes it compelling.
      
      Title: {book['title']}
      Author: {book['author']}
      Genre: {book.get('genre', 'Unknown')}
      Description: {book.get('description', 'No description available')}
      
      Summary:
      """
      response = llm.invoke(prompt)
      return response.content
      ```
    - Returns the generated summary string

  - `get_or_generate_summary(book_id: str) -> dict`
    - Check `book_summaries` table for cached summary
    - If cached, return `{ summary, generated_at, cached: True }`
    - If not cached:
      - Fetch book details from `books` table
      - Call `generate_book_summary(book)`
      - Store in `book_summaries` table
      - Return `{ summary, generated_at, cached: False }`

- [ ] **Backend endpoint:** `GET /api/books/{id}/summary`
  - Authenticated users only
  - Calls `get_or_generate_summary(book_id)`
  - Returns: `{ book_id, summary, generated_at, cached }`
  - If book not found → 404
  - Rate limit: max 30 summary generations per user per hour

- [ ] **Backend schema:** `backend/app/schemas/book.py` — add:
  ```python
  class BookSummary(BaseModel):
      book_id: str
      summary: str
      generated_at: str
      cached: bool
  ```

- [ ] **Frontend component:** `AIBookSummary`
  - "AI Summary" button (sparkle icon + text)
  - On click: loading spinner → fetch `GET /api/books/{id}/summary`
  - Display summary in a styled card/tooltip below the button
  - Collapse/expand toggle for the summary text
  - Show "AI Generated" badge + timestamp

- [ ] **Frontend:** Add `AIBookSummary` button to:
  - Book detail page (`/books/[id]`) — below the description section
  - Book cards on the `/books` catalog page — small icon button that expands inline
  - Discovery results (`/reader/discover`) — on each discovered book card


## New Router Registration

```python
# backend/app/main.py — updated router registration
from app.routers import books, search, auth, borrow, librarian, smart_search, discovery, book_requests

# Order matters — more specific routes first
app.include_router(smart_search.router)    # /api/books/smart-search
app.include_router(search.router)          # /api/books/search
app.include_router(discovery.router)       # /api/books/discover
app.include_router(book_requests.router)   # /api/book-requests
app.include_router(borrow.router)
app.include_router(librarian.router)
app.include_router(books.router)
app.include_router(auth.router)
```

## New Frontend Pages & Components Summary

| Page / Component | Path | Role | Description |
|---|---|---|---|
| Smart Search (updated) | `/books` | All | AI-powered search bar with semantic + keyword hybrid search |
| Book Discovery | `/reader/discover` | Reader | Paragraph-based AI book discovery from the web |
| My Book Requests | `/reader/requests` | Reader | View submitted book requests and their status |
| Book Request Modal | (component) | Reader | Modal to request a book not in the catalog |
| AI Book Summary | (component) | All | Generate and display AI summaries inline |
| Librarian Book Requests | `/librarian/dashboard` (new section) | Librarian | Review and approve/reject reader book requests |

## New Backend Files Summary

| File | Purpose |
|---|---|
| `backend/app/services/smart_search.py` | NLP query interpretation + hybrid semantic/keyword search |
| `backend/app/services/book_discovery.py` | Paragraph-based web book discovery pipeline |
| `backend/app/services/book_summary.py` | AI summary generation + caching (Gemini LLM) |
| `backend/app/routers/smart_search.py` | `GET /api/books/smart-search` endpoint |
| `backend/app/routers/discovery.py` | `POST /api/books/discover` endpoint |
| `backend/app/routers/book_requests.py` | CRUD endpoints for book requests |
| `backend/app/schemas/discovery.py` | Pydantic models for discovery feature |
| `backend/app/schemas/book_request.py` | Pydantic models for book request feature |
| `supabase/migrations/006_book_requests.sql` | Book requests table + RLS |
| `supabase/migrations/007_book_summaries.sql` | AI summaries cache table + RLS |

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/books/smart-search?q=&genre=&status=&page=&limit=` | Any authenticated | NLP-powered hybrid search |
| `POST` | `/api/books/discover` | Reader | AI paragraph-based book discovery |
| `GET` | `/api/books/{id}/summary` | Any authenticated | Get or generate AI book summary |
| `POST` | `/api/book-requests` | Reader | Submit a book request |
| `GET` | `/api/book-requests` | Reader | List own book requests |
| `GET` | `/api/librarian/book-requests?status=&page=&limit=` | Librarian | List all book requests |
| `POST` | `/api/librarian/book-requests/{id}/review` | Librarian | Approve or reject a book request |

## Acceptance Criteria

- [ ] Main search bar supports natural language queries (e.g., "a mystery novel set in Japan")
- [ ] Smart search uses pgvector semantic similarity + ILIKE keyword fallback (hybrid approach)
- [ ] Smart search falls back to classic ILIKE for simple keyword queries (< 3 words)
- [ ] Users can toggle between AI Search and Classic Search modes
- [ ] Relevance scores are displayed on search results when using AI Search
- [ ] Reader can write a paragraph and get AI-curated book recommendations from the web
- [ ] Discovered books are cross-referenced against the library catalog
- [ ] Books in catalog show availability status and "Borrow" link
- [ ] Books not in catalog show "Request This Book" button
- [ ] Book requests are stored and shown to librarians on the dashboard
- [ ] Librarians can approve/reject book requests with notes
- [ ] Approved requests can optionally auto-create the book in the catalog
- [ ] Every book has a "Generate AI Summary" button
- [ ] AI summaries are cached in `book_summaries` table (generate once, serve from cache)
- [ ] Summaries are concise (3-4 sentences), spoiler-free, and engaging
- [ ] All AI features use Google Gemini (LLM + embeddings) — no OpenAI dependency
- [ ] Rate limiting on discovery (10/hour) and summary generation (30/hour) endpoints
- [ ] Existing search endpoint (`GET /api/books/search`) remains fully functional
- [ ] All new tables have proper RLS policies
- [ ] Error handling for LLM timeouts, API failures, and empty results
