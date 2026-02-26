-- ============================================================
-- Promote a user to librarian role
-- Replace 'user@example.com' with the actual email address
-- Run this in the Supabase SQL Editor
-- ============================================================

UPDATE public.users
SET role = 'librarian'
WHERE email = 'user@example.com';

-- Verify the update
SELECT id, email, role, name FROM public.users WHERE role = 'librarian';
