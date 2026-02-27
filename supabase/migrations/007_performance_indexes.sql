-- Performance indexes for borrow_records queries
-- These composite indexes cover the most common query patterns

-- Active borrow check: WHERE user_id = X AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_borrow_records_user_status
  ON public.borrow_records (user_id, status);

-- Overdue query: WHERE status = 'active' AND due_date < NOW()
CREATE INDEX IF NOT EXISTS idx_borrow_records_status_due_date
  ON public.borrow_records (status, due_date);

-- Active borrow by book: WHERE book_id = X AND status IN (...)
CREATE INDEX IF NOT EXISTS idx_borrow_records_book_status
  ON public.borrow_records (book_id, status);

-- Book requests by status (for dashboard pending count)
CREATE INDEX IF NOT EXISTS idx_book_requests_status
  ON public.book_requests (status);

-- Users by role (for reader count)
CREATE INDEX IF NOT EXISTS idx_users_role
  ON public.users (role);
