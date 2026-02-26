from supabase import create_client, Client
from app.core.config import get_settings


def get_supabase_client() -> Client:
    """Returns a Supabase client using the publishable/anon key."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_admin() -> Client:
    """Returns a Supabase client using the service role key (bypasses RLS).
    Authorization is enforced at the FastAPI layer via require_librarian."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
