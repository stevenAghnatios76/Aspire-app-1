from fastapi import APIRouter, Depends
from app.core.auth import get_current_user
from app.core.rate_limit import discovery_limiter
from app.schemas.discovery import DiscoveryRequest, DiscoveryResponse
from app.services.book_discovery import discover_books

router = APIRouter(prefix="/api/books", tags=["discovery"])


@router.post("/discover", response_model=DiscoveryResponse)
async def discover_books_endpoint(
    request: DiscoveryRequest,
    current_user: dict = Depends(get_current_user),
):
    """AI-powered book discovery from a natural language description."""
    discovery_limiter.check(current_user["id"])
    result = discover_books(request.paragraph)
    return result
