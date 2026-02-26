"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type DiscoveredBook } from "@/lib/api";
import Link from "next/link";
import BookRequestModal from "@/components/BookRequestModal";

export default function DiscoverPage() {
  const { getToken } = useAuth();
  const [paragraph, setParagraph] = useState("");
  const [books, setBooks] = useState<DiscoveredBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [requestModal, setRequestModal] = useState<{
    isOpen: boolean;
    book?: DiscoveredBook;
  }>({ isOpen: false });

  const handleDiscover = async () => {
    if (paragraph.trim().length < 20) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await api.discoverBooks(token, paragraph);
      setBooks(result.books);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Book Discovery</h1>
      <p className="text-gray-500 text-sm mb-6">
        Describe what you&apos;re in the mood to read and our AI will find books you&apos;ll love.
      </p>

      <div className="mb-8">
        <textarea
          value={paragraph}
          onChange={(e) => setParagraph(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          placeholder="Example: I'm looking for thought-provoking science fiction that explores artificial intelligence and consciousness. I loved Neuromancer and Blade Runner. Something with philosophical depth but still action-packed..."
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">
            {paragraph.length}/2000 characters (min 20)
          </span>
          <button
            onClick={handleDiscover}
            disabled={isLoading || paragraph.trim().length < 20}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Discovering...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                </svg>
                Discover Books
              </>
            )}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Our AI is searching for books you&apos;ll love...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      {!isLoading && hasSearched && books.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          No books found. Try describing your interests in more detail.
        </p>
      )}

      {!isLoading && books.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book, idx) => (
            <div
              key={`${book.title}-${idx}`}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">📖</span>
                )}
                {book.in_catalog && (
                  <span className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    In Library
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                  {book.title}
                </h3>
                <p className="text-gray-500 text-xs mt-1">{book.author}</p>
                {book.relevance_reason && (
                  <p className="text-purple-600 text-xs mt-2 italic line-clamp-2">
                    {book.relevance_reason}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {book.in_catalog && book.catalog_book_id ? (
                    <Link
                      href={`/books/${book.catalog_book_id}`}
                      className="text-xs px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium hover:bg-green-100 transition-colors"
                    >
                      {book.available_copies != null && book.available_copies > 0
                        ? `Available (${book.available_copies} copies)`
                        : "View in Library"}
                    </Link>
                  ) : (
                    <button
                      onClick={() => setRequestModal({ isOpen: true, book })}
                      className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-medium hover:bg-indigo-100 transition-colors"
                    >
                      Request This Book
                    </button>
                  )}
                  {book.source_url && (
                    <a
                      href={book.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded-full font-medium hover:bg-gray-100 transition-colors"
                    >
                      More Info
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BookRequestModal
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal({ isOpen: false })}
        prefill={
          requestModal.book
            ? {
                title: requestModal.book.title,
                author: requestModal.book.author,
                isbn: requestModal.book.isbn || undefined,
                cover_url: requestModal.book.cover_url || undefined,
                source_url: requestModal.book.source_url || undefined,
                description: requestModal.book.description || undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
