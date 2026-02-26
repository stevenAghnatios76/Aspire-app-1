"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type BookSummaryResponse } from "@/lib/api";

interface AIBookSummaryProps {
  bookId: string;
}

export default function AIBookSummary({ bookId }: AIBookSummaryProps) {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<BookSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.getBookSummary(token, bookId);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setIsLoading(false);
    }
  };

  if (!summary) {
    return (
      <div className="mt-6">
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60 border border-purple-200"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
              Generating AI Summary...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
              </svg>
              AI Summary
            </>
          )}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
          </svg>
          <span className="text-sm font-semibold text-purple-700">AI Summary</span>
          {summary.cached && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
              cached
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-purple-600 hover:text-purple-800 text-sm"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {isExpanded && (
        <p className="text-sm text-gray-700 leading-relaxed">{summary.summary}</p>
      )}
    </div>
  );
}
