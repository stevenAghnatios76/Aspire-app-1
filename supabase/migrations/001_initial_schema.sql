-- ============================================================
-- Mini Library Management System — Full Database Setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('librarian', 'reader')),
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Books table
CREATE TABLE IF NOT EXISTS public.books (
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
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Borrow records table
CREATE TABLE IF NOT EXISTS public.borrow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  returned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Google Books cache table (used in MS3)
CREATE TABLE IF NOT EXISTS public.google_books_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  similar_books JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(book_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_books_cache ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users are viewable by authenticated users"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own record"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Books policies
CREATE POLICY "Books are viewable by authenticated users"
  ON public.books FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Librarians can insert books"
  ON public.books FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );

CREATE POLICY "Librarians can update books"
  ON public.books FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );

CREATE POLICY "Librarians can delete books"
  ON public.books FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );

-- Borrow records policies
CREATE POLICY "Users can view own borrow records"
  ON public.borrow_records FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );

CREATE POLICY "Users can insert own borrow records"
  ON public.borrow_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own borrow records"
  ON public.borrow_records FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'librarian')
  );

-- Google Books cache policies
CREATE POLICY "Cache is viewable by authenticated users"
  ON public.google_books_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert cache"
  ON public.google_books_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- Trigger: Auto-create user profile on signup
-- ============================================================

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

-- Drop if exists to make script re-runnable
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_books_title ON public.books USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_books_author ON public.books USING gin (to_tsvector('english', author));
CREATE INDEX IF NOT EXISTS idx_books_genre ON public.books (genre);
CREATE INDEX IF NOT EXISTS idx_books_status ON public.books (status);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON public.books (isbn);
CREATE INDEX IF NOT EXISTS idx_borrow_records_user_id ON public.borrow_records (user_id);
CREATE INDEX IF NOT EXISTS idx_borrow_records_book_id ON public.borrow_records (book_id);
CREATE INDEX IF NOT EXISTS idx_borrow_records_status ON public.borrow_records (status);

-- pgvector index for similarity search (used in MS3)
CREATE INDEX IF NOT EXISTS idx_books_embedding ON public.books
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
