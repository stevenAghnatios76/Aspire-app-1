"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type BookRequest } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  fulfilled: "bg-blue-100 text-blue-700",
};

export default function MyRequestsPage() {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getMyBookRequests(token);
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Book Requests</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          You haven&apos;t made any book requests yet.
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white border border-gray-200 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{req.title}</h3>
                  {req.author && (
                    <p className="text-sm text-gray-600 mt-0.5">by {req.author}</p>
                  )}
                  {req.reason && (
                    <p className="text-sm text-gray-500 mt-2 italic">
                      &quot;{req.reason}&quot;
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      statusStyles[req.status] || ""
                    }`}
                  >
                    {req.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(req.created_at)}
                  </span>
                </div>
              </div>
              {req.librarian_note && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 font-medium mb-1">Librarian note:</p>
                  <p className="text-sm text-gray-700">{req.librarian_note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
