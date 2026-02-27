"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type Book, type PaginatedBooks } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";

export default function BooksPage() {
  const { getToken, isLibrarian, session } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchMode, setSearchMode] = useState<"ai" | "classic">("ai");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBooks = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      let result: PaginatedBooks;

      if (searchMode === "ai" && search) {
        result = await api.smartSearchBooks(token, {
          q: search,
          genre: genreFilter,
          status: statusFilter,
          page,
          limit: 12,
        });
      } else if (search || genreFilter || statusFilter) {
        result = await api.searchBooks(token, {
          q: search,
          genre: genreFilter,
          status: statusFilter,
          page,
          limit: 12,
        });
      } else {
        result = await api.listBooks(token, page, 12);
      }
      setBooks(result.data);
      setPagination({
        page: result.page,
        total_pages: result.total_pages,
        total: result.total,
      });
    } catch (err) {
      console.error("Failed to fetch books:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, genreFilter, statusFilter, searchMode, getToken]);

  // Debounce for AI mode, immediate for classic/filters
  useEffect(() => {
    // Don't attempt to fetch until auth session is available
    if (!session) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchMode === "ai" && search) {
      // Debounce AI searches by 500ms
      debounceRef.current = setTimeout(() => fetchBooks(1), 500);
    } else {
      // Classic search / filters / no search: fire immediately
      fetchBooks(1);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, genreFilter, statusFilter, searchMode, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await api.deleteBook(token, id);
      fetchBooks(pagination.page);
    } catch (err) {
      console.error("Failed to delete book:", err);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: "bg-green-100 text-green-700",
      checked_out: "bg-yellow-100 text-yellow-700",
      unavailable: "bg-red-100 text-red-700",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || ""}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Book Catalog</h1>
        {isLibrarian && (
          <Link
            href="/librarian/books/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Add Book
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[250px] relative">
          <input
            type="text"
            placeholder={
              searchMode === "ai"
                ? "Describe what you'd like to read..."
                : "Search by title, author, genre, ISBN..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setSearchMode(searchMode === "ai" ? "classic" : "ai")}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
            searchMode === "ai"
              ? "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
              : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
          title={searchMode === "ai" ? "Switch to classic search" : "Switch to AI search"}
        >
          {searchMode === "ai" ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
              </svg>
              AI
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Classic
            </>
          )}
        </button>
        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Genres</option>
          <option value="Fiction">Fiction</option>
          <option value="Classic">Classic</option>
          <option value="Fantasy">Fantasy</option>
          <option value="Science Fiction">Science Fiction</option>
          <option value="Dystopian">Dystopian</option>
          <option value="Romance">Romance</option>
          <option value="Gothic">Gothic</option>
          <option value="Non-Fiction">Non-Fiction</option>
          <option value="Memoir">Memoir</option>
          <option value="Magical Realism">Magical Realism</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="checked_out">Checked Out</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {/* Book Grid */}
      {!isLoading && (
        <>
          {books.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No books found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  <Link href={`/books/${book.id}`}>
                    <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative">
                      {book.cover_url ? (
                        <Image
                          src={book.cover_url}
                          alt={book.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <span className="text-4xl">📖</span>
                      )}
                      {searchMode === "ai" && book.relevance != null && (
                        <span className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                          {Math.round(book.relevance * 100)}% match
                        </span>
                      )}
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link href={`/books/${book.id}`}>
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 hover:text-indigo-600">
                        {book.title}
                      </h3>
                    </Link>
                    <p className="text-gray-500 text-xs mt-1">{book.author}</p>
                    <div className="flex items-center justify-between mt-3">
                      {statusBadge(book.status)}
                      <span className="text-xs text-gray-400">
                        {book.available_copies}/{book.total_copies} avail
                      </span>
                    </div>
                    {isLibrarian && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <Link
                          href={`/librarian/books/${book.id}/edit`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(book.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => fetchBooks(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.total_pages} ({pagination.total} books)
              </span>
              <button
                onClick={() => fetchBooks(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
