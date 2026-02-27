from supabase import create_client, Client
from app.core.config import get_settings

# Module-level singletons — created once, reused across all requests.
# The Supabase Python client uses httpx under the hood which manages
# its own connection pool, so a single instance is safe and efficient.
_client: Client | None = None
_admin: Client | None = None


def get_supabase_client() -> Client:
    """Returns a cached Supabase client using the publishable/anon key."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _client


def get_supabase_admin() -> Client:
    """Returns a cached Supabase client using the service role key (bypasses RLS).
    Authorization is enforced at the FastAPI layer via require_librarian."""
    global _admin
    if _admin is None:
        settings = get_settings()
        _admin = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _admin
