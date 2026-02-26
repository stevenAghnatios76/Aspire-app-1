-- Migration 004: RPC function for finding similar books via pgvector cosine similarity
-- Called from backend via supabase.rpc("find_similar_books", {...})
-- Used on the book detail page "You might also like" section

CREATE OR REPLACE FUNCTION find_similar_books(
  query_embedding vector(768),
  exclude_book_id uuid,
  result_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  author text,
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
    b.cover_url,
    1 - (b.embedding <=> query_embedding) AS similarity
  FROM public.books b
  WHERE b.id != exclude_book_id
    AND b.embedding IS NOT NULL
  ORDER BY b.embedding <=> query_embedding
  LIMIT result_limit;
$$;
