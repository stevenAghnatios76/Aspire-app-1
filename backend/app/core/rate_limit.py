import time
import threading
from fastapi import HTTPException, status


class RateLimiter:
    """In-memory per-user rate limiter with a sliding window."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._requests: dict[str, list[float]] = {}

    def check(self, user_id: str) -> None:
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            timestamps = self._requests.get(user_id, [])
            # Remove expired entries
            timestamps = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= self.max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window_seconds // 3600} hour(s).",
                )

            timestamps.append(now)
            self._requests[user_id] = timestamps


# Pre-configured limiters
discovery_limiter = RateLimiter(max_requests=10, window_seconds=3600)
summary_limiter = RateLimiter(max_requests=30, window_seconds=3600)
