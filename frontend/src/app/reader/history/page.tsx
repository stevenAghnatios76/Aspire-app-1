"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type BorrowHistoryItem } from "@/lib/api";
import Link from "next/link";

const statusStyles: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  active: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  returned: "bg-green-100 text-green-700",
  pending_return: "bg-yellow-100 text-yellow-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReaderHistoryPage() {
  const { getToken } = useAuth();
  const [history, setHistory] = useState<BorrowHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getMyHistory(token);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Poll every 10s so librarian approvals appear live
  const fetchHistoryRef = useRef(fetchHistory);
  fetchHistoryRef.current = fetchHistory;
  useEffect(() => {
    const id = setInterval(() => fetchHistoryRef.current(), 10_000);
    return () => clearInterval(id);
  }, []);

  const handleReturn = async (recordId: string) => {
    setReturningId(recordId);
    try {
      const token = await getToken();
      if (!token) return;
      await api.returnBook(token, recordId);
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to return book");
    } finally {
      setReturningId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Borrow History</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {history.length === 0 ? (
        <p className="text-gray-500 italic">You haven&apos;t borrowed any books yet.</p>
      ) : (
        <div className="space-y-4">
          {history.map((record) => (
            <div
              key={record.id}
              className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm"
            >
              {/* Cover thumbnail */}
              <div className="w-14 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {record.book?.cover_url ? (
                  <img
                    src={record.book.cover_url}
                    alt={record.book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl">📖</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 truncate">
                      {record.book?.title ?? "Unknown title"}
                    </p>
                    <p className="text-sm text-gray-500">{record.book?.author ?? "Unknown author"}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusStyles[record.status]}`}
                  >
                    {record.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Borrowed: {formatDate(record.borrowed_at)}</span>
                  <span>Due: {formatDate(record.due_date)}</span>
                  {record.returned_at && (
                    <span>Returned: {formatDate(record.returned_at)}</span>
                  )}
                </div>
              </div>

              {/* Return button */}
              {(record.status === "active" || record.status === "overdue") && (
                <div className="flex items-center flex-shrink-0">
                  <button
                    onClick={() => handleReturn(record.id)}
                    disabled={returningId === record.id}
                    className="px-4 py-1.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-60"
                  >
                    {returningId === record.id ? "Requesting…" : "Return"}
                  </button>
                </div>
              )}
              {record.status === "pending_return" && (
                <div className="flex items-center flex-shrink-0">
                  <span className="px-4 py-1.5 bg-yellow-100 text-yellow-700 text-sm rounded-lg font-medium">
                    Pending Approval
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/books" className="text-indigo-600 hover:underline text-sm">
          ← Browse catalog
        </Link>
      </div>
    </div>
  );
}
