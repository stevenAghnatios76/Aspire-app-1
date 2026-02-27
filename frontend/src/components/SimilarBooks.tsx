"use client";

import { useAuthSWR } from "@/lib/swr";
import { type SimilarBook } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";

interface SimilarBooksProps {
  bookId: string;
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-40 animate-pulse">
      <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export default function SimilarBooks({ bookId }: SimilarBooksProps) {
  const { data: books, error, isLoading } = useAuthSWR<SimilarBook[]>(
    `/api/books/${bookId}/similar`
  );

  if (isLoading) {
    return (
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">You might also like</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">You might also like</h2>
        <p className="text-gray-400 text-sm italic">Could not load similar books.</p>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">You might also like</h2>
        <p className="text-gray-400 text-sm italic">No similar books found.</p>
      </div>
    );
  }

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">You might also like</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/books/${book.id}`}
            className="flex-shrink-0 w-40 group"
          >
            <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center relative">
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="160px"
                />
              ) : (
                <span className="text-4xl">📖</span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
              {book.title}
            </p>
            <p className="text-xs text-gray-500 line-clamp-1">{book.author}</p>
            <p className="text-xs text-indigo-500 mt-1">{Math.round(book.similarity * 100)}% match</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
