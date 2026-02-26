"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { profile, isLibrarian, signOut, isLoading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (isLoading || !profile) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/books" className="text-xl font-bold text-indigo-600">
            📚 Aspire Library
          </Link>
          <Link
            href="/books"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            Catalog
          </Link>
          {isLibrarian && (
            <>
              <Link
                href="/librarian/dashboard"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/librarian/books/new"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                + Add Book
              </Link>
            </>
          )}
          {!isLibrarian && (
            <>
              <Link
                href="/reader/discover"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Discover
              </Link>
              <Link
                href="/reader/history"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                My Borrows
              </Link>
              <Link
                href="/reader/requests"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                My Requests
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/info"
            className="text-sm font-semibold px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
          >
            Info
          </Link>
          <div className="flex items-center gap-2">
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-sm text-gray-700">{profile.name || profile.email}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isLibrarian
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {profile.role}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
