import useSWR, { type SWRConfiguration } from "swr";
import { useAuth } from "@/components/AuthProvider";
import { useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Authenticated fetcher used by SWR hooks.
 * Accepts a [url, token] tuple so the cache key includes the URL.
 */
async function authFetcher<T>([url, token]: [string, string]): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({
      detail: "An unexpected error occurred",
    }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Drop-in SWR hook with automatic auth token injection.
 *
 * Usage:
 *   const { data, error, isLoading, mutate } = useAuthSWR<Book[]>("/api/books");
 *   const { data } = useAuthSWR<Book>(`/api/books/${id}`);
 *
 * Pass `null` as the key to conditionally skip the request:
 *   useAuthSWR(shouldFetch ? `/api/books/${id}` : null);
 *
 * SWR automatically deduplicates identical keys — if two components request
 * the same URL concurrently, only one network request is made.
 */
export function useAuthSWR<T = unknown>(
  key: string | null,
  config?: SWRConfiguration<T>
) {
  const { getToken } = useAuth();

  const fetcher = useCallback(
    async ([url]: [string, string]): Promise<T> => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return authFetcher<T>([url, token]);
    },
    [getToken]
  );

  return useSWR<T>(
    // When key is null, SWR skips the request entirely
    key ? [key, "auth"] : null,
    fetcher,
    {
      revalidateOnFocus: false,   // avoid refetch on every tab switch
      dedupingInterval: 5000,     // dedupe identical requests within 5s
      errorRetryCount: 2,         // retry failed requests twice
      ...config,
    }
  );
}
