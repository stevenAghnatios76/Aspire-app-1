"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type RecommendationResponse } from "@/lib/api";
import Link from "next/link";

interface ReaderRecommendationsProps {
  userId: string;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse p-4 bg-gray-50 rounded-xl">
      <div className="flex gap-3">
        <div className="w-12 h-16 bg-gray-200 rounded flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

export default function ReaderRecommendations({ userId }: ReaderRecommendationsProps) {
  const { getToken } = useAuth();
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleRecommend = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setEmailSent(false);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getReaderRecommendations(token, userId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get recommendations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.sendRecommendationEmail(token, userId);
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="mb-8 p-5 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">AI Recommendations</h2>
        <div className="flex gap-2">
          {result && result.books.length > 0 && (
            <button
              onClick={handleSendEmail}
              disabled={isSendingEmail || emailSent}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {emailSent ? "Email Sent!" : isSendingEmail ? "Sending…" : "Send via Email"}
            </button>
          )}
          <button
            onClick={handleRecommend}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
          >
            {isLoading ? "Analyzing…" : "Recommend Books"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-3">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {result && !isLoading && (
        <>
          {result.message && result.books.length === 0 && (
            <p className="text-gray-500 text-sm italic">{result.message}</p>
          )}

          {result.books.length > 0 && (
            <div className="space-y-3">
              {result.books.map((book) => (
                <Link
                  key={book.id}
                  href={`/books/${book.id}`}
                  className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="w-12 h-16 bg-gray-200 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl">📖</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{book.title}</p>
                      <p className="text-sm text-gray-500">{book.author}</p>
                      {book.genre && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                          {book.genre}
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-lg">
                        {book.similarity}%
                      </span>
                      <p className="text-xs text-gray-400 mt-1">match</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!result && !isLoading && !error && (
        <p className="text-gray-400 text-sm italic">
          Click &quot;Recommend Books&quot; to generate AI-powered personalized recommendations based on this reader&apos;s borrow history.
        </p>
      )}
    </div>
  );
}
