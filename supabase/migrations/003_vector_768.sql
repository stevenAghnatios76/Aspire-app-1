-- Migration 003: Change embedding column from vector(1536) (OpenAI) to vector(768) (Google Gemini)
-- Google's text-embedding-004 model produces 768-dimensional vectors

-- Drop the existing index (references old dimension)
DROP INDEX IF EXISTS idx_books_embedding;

-- Alter the column dimension
ALTER TABLE public.books
  ALTER COLUMN embedding TYPE vector(768)
  USING NULL;  -- Clear existing embeddings since they were a different dimension

-- Recreate the IVFFlat index with the new dimension
-- (IVFFlat requires at least some rows to build; use HNSW which works on empty tables)
CREATE INDEX idx_books_embedding ON public.books
  USING hnsw (embedding vector_cosine_ops);
