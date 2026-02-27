from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.supabase import get_supabase_admin
import logging
import time
import threading

logger = logging.getLogger(__name__)
security = HTTPBearer()

# Simple TTL cache for user profiles — avoids a DB query on every request.
# keyed by user_id → (profile_dict, expiry_timestamp)
_profile_cache: dict[str, tuple[dict, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 300  # 5 minutes


def _get_cached_profile(user_id: str) -> dict | None:
    """Return cached profile if still valid, else None."""
    with _cache_lock:
        entry = _profile_cache.get(user_id)
        if entry and entry[1] > time.time():
            return entry[0]
        # Expired or missing
        _profile_cache.pop(user_id, None)
        return None


def _set_cached_profile(user_id: str, profile: dict) -> None:
    """Cache a profile with TTL."""
    with _cache_lock:
        _profile_cache[user_id] = (profile, time.time() + _CACHE_TTL)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Verify the Supabase JWT via Supabase Auth and return the user dict.
    Uses an in-memory cache for the profile lookup to avoid a DB round trip
    on every authenticated request.
    """
    token = credentials.credentials
    supabase = get_supabase_admin()

    try:
        user_response = supabase.auth.get_user(jwt=token)
        auth_user = user_response.user if user_response else None
        if not auth_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )

    user_id = auth_user.id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Check cache first
    cached = _get_cached_profile(user_id)
    if cached:
        return cached

    # Cache miss — fetch from DB
    try:
        result = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if result.data:
            _set_cached_profile(user_id, result.data)
            return result.data
    except Exception:
        pass

    # No profile yet — user must complete onboarding first
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="profile_setup_required",
    )


def require_librarian(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires the current user to be a librarian."""
    if current_user.get("role") != "librarian":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Librarian access required",
        )
    return current_user
