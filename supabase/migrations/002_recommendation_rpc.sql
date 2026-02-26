-- Migration 002: Recommendation RPC function for pgvector cosine similarity search
-- Called from backend via supabase.rpc("recommend_books_for_reader", {...})

CREATE OR REPLACE FUNCTION recommend_books_for_reader(
  taste_vector vector(768),
  reader_id uuid,
  result_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  author text,
  genre text,
  cover_url text,
  similarity float8
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.id,
    b.title,
    b.author,
    b.genre,
    b.cover_url,
    1 - (b.embedding <=> taste_vector) AS similarity
  FROM public.books b
  WHERE b.id NOT IN (
    SELECT br.book_id FROM public.borrow_records br WHERE br.user_id = reader_id
  )
    AND b.embedding IS NOT NULL
    AND b.available_copies > 0
  ORDER BY b.embedding <=> taste_vector
  LIMIT result_limit;
$$;
