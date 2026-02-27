-- Performance: single-query dashboard stats instead of 6 sequential count queries
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total_books',
      (SELECT count(*) FROM books),
    'total_checked_out',
      (SELECT count(*) FROM borrow_records WHERE status IN ('active', 'overdue', 'pending_return')),
    'total_overdue',
      (SELECT count(*) FROM borrow_records WHERE status = 'overdue'),
    'total_pending_returns',
      (SELECT count(*) FROM borrow_records WHERE status = 'pending_return'),
    'total_readers',
      (SELECT count(*) FROM users WHERE role = 'reader'),
    'total_pending_requests',
      (SELECT count(*) FROM book_requests WHERE status = 'pending')
  );
$$;
