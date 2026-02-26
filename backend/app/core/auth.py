from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.supabase import get_supabase_admin
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Verify the Supabase JWT via Supabase Auth and return the user dict.
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

    # Fetch user profile from public.users to get role
    try:
        result = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if result.data:
            return result.data
    except Exception:
        pass

    # No profile yet — user must complete onboarding first
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="profile_setup_required",
    )


async def require_librarian(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires the current user to be a librarian."""
    if current_user.get("role") != "librarian":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Librarian access required",
        )
    return current_user
