# Milestone 1 — Foundation: Scaffolding, Auth & Book CRUD

## Context

You are building a **Mini Library Management System**. This is Milestone 1 of 3.

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
- Full CRUD on all books
- View all readers and their full borrow history *(MS2)*
- Trigger AI-powered personalized book recommendations for any reader *(MS3)*
- Approve reader return requests before books are marked as returned *(MS2)*
- View dashboard: total books, currently checked out, overdue, pending returns *(MS2)*

**Reader**
- Browse and search the catalog *(MS2)*
- Check out books (self-service) and request returns (librarian-approved) *(MS2)*
- View their own borrow history *(MS2)*
- See AI-generated similar book recommendations on any book detail page *(MS3)*
- Cannot access other readers' data or librarian tools

## Data Models

```sql
-- Enable pgvector extension (created now, used in MS3)
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('librarian', 'reader')),
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT UNIQUE,
  genre TEXT,
  description TEXT,
  cover_url TEXT,
  published_year INTEGER,
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'checked_out', 'unavailable')),
  embedding vector(1536),  -- populated in MS3
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Borrow records table (used in MS2, created now)
CREATE TABLE public.borrow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'pending_return')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read, only the user themselves can update their own row
CREATE POLICY "Users are viewable by authenticated users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own record" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Books: anyone authenticated can read, librarians can insert/update/delete
CREATE POLICY "Books are viewable by authenticated users" ON public.books FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Librarians can insert books" ON public.books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
);
CREATE POLICY "Librarians can update books" ON public.books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
);
CREATE POLICY "Librarians can delete books" ON public.books FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
);

-- Borrow records: readers see own, librarians see all
CREATE POLICY "Users can view own borrow records" ON public.borrow_records FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
);
CREATE POLICY "Users can insert own borrow records" ON public.borrow_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own borrow records" ON public.borrow_records FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
);
```

## Auth Flow

1. Supabase Auth with **Google OAuth** (SSO)
2. On first login, a trigger inserts a row into `public.users` with `role = 'reader'`
3. Librarian role must be manually assigned in Supabase (or via a seed script)
4. Protected routes via Next.js middleware checking Supabase session + role

```sql
-- Trigger to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Tasks for This Milestone

### 1. Project Scaffolding
- [x] Create Next.js 14 app with App Router in `frontend/`
- [x] Create FastAPI project in `backend/`
- [x] Set up environment variable files (`.env.local`, `.env`)
- [x] Configure CORS on FastAPI to allow frontend origin
- [x] Install dependencies: `@supabase/supabase-js`, `@supabase/ssr` (frontend); `supabase`, `fastapi`, `uvicorn`, `python-dotenv` (backend)

### 2. Supabase Setup
- [x] Create Supabase project (manual step — document instructions)
- [x] Run the SQL migrations above (all 3 tables + RLS + trigger)
- [x] Enable Google OAuth provider in Supabase dashboard
- [x] Enable pgvector extension

### 3. Auth Implementation
- [x] Implement Google OAuth login/logout on frontend using Supabase Auth
- [x] Create auth callback route (`/auth/callback`)
- [x] Create Next.js middleware to protect routes based on session + role
- [x] Create `useUser` hook or context provider for client components
- [x] Backend: create FastAPI dependency to verify Supabase JWT and extract user/role

### 4. Book CRUD (Librarian Only)
- [x] **Backend endpoints:**
  - `GET /api/books` — list all books (paginated)
  - `GET /api/books/{id}` — get single book
  - `POST /api/books` — create book (librarian only)
  - `PUT /api/books/{id}` — update book (librarian only)
  - `DELETE /api/books/{id}` — delete book (librarian only)
- [x] **Frontend pages:**
  - `/books` — catalog listing (all users)
  - `/books/[id]` — book detail page
  - `/librarian/books/new` — add book form (librarian only)
  - `/librarian/books/[id]/edit` — edit book form (librarian only)
- [x] Form validation for required fields
- [x] Toast/notification on success/error

### 5. Seed Data
- [x] Create a seed script that inserts 15-20 sample books
- [x] Create a seed script that promotes a user to librarian role

## Acceptance Criteria

- [x] Next.js frontend and FastAPI backend both run locally
- [x] User can sign in with Google via Supabase Auth
- [x] New users auto-get `reader` role; librarian role assignable via script
- [x] Librarian can create, read, update, delete books
- [x] Reader can view book catalog and book details but cannot add/edit/delete
- [x] All 3 database tables exist with proper RLS policies
- [x] pgvector extension is enabled (embedding column exists on books)
