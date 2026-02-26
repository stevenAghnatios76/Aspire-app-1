from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.auth import get_current_user
from app.core.supabase import get_supabase_admin
from app.schemas.user import UserResponse, UserSetupInput

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return current_user


@router.post("/setup", response_model=UserResponse)
async def setup_user(
    body: UserSetupInput,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Create a user profile with a chosen role on first sign-in.
    If a profile already exists the existing profile is returned unchanged.
    """
    token = credentials.credentials
    supabase = get_supabase_admin()

    # Verify JWT
    try:
        user_response = supabase.auth.get_user(jwt=token)
        auth_user = user_response.user if user_response else None
        if not auth_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    user_id = auth_user.id

    # If profile already exists, return it (no role changes after creation)
    try:
        existing = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if existing.data:
            return existing.data
    except Exception:
        pass

    # Create profile with chosen role
    user_data = {
        "id": user_id,
        "email": auth_user.email or "",
        "name": (auth_user.user_metadata or {}).get("name", ""),
        "role": body.role,
        "avatar_url": (auth_user.user_metadata or {}).get("avatar_url")
        or (auth_user.user_metadata or {}).get("picture"),
    }
    result = supabase.table("users").insert(user_data).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile",
        )
    return result.data[0]
