-- Migration 005: Update borrow_records status CHECK constraint
-- MS2 introduced 'pending' (checkout approval) and 'pending_return' (return approval) statuses
-- The original schema only allowed: active, returned, overdue

ALTER TABLE public.borrow_records
  DROP CONSTRAINT IF EXISTS borrow_records_status_check;

ALTER TABLE public.borrow_records
  ADD CONSTRAINT borrow_records_status_check
  CHECK (status IN ('pending', 'active', 'returned', 'overdue', 'pending_return'));
