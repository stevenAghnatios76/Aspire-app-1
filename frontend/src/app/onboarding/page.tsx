"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const { profile, isLoading, getToken } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<"reader" | "librarian" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user already has a profile, skip onboarding
  useEffect(() => {
    if (!isLoading && profile) {
      router.replace("/books");
    }
  }, [isLoading, profile, router]);

  const handleContinue = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await api.setupUser(token, selected);
      // Force a full reload so AuthProvider re-fetches the new profile
      window.location.href = "/books";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to 📚 Mini Library</h1>
          <p className="text-gray-600">How will you be using the library?</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Reader card */}
          <button
            onClick={() => setSelected("reader")}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all text-left ${
              selected === "reader"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className="text-4xl">📖</span>
            <div>
              <p className="font-semibold text-gray-900">Reader</p>
              <p className="text-xs text-gray-500 mt-1">
                Browse the catalog, borrow books, and track your reading history.
              </p>
            </div>
            {selected === "reader" && (
              <span className="text-xs font-medium text-indigo-600">Selected ✓</span>
            )}
          </button>

          {/* Librarian card */}
          <button
            onClick={() => setSelected("librarian")}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all text-left ${
              selected === "librarian"
                ? "border-purple-600 bg-purple-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className="text-4xl">🗂️</span>
            <div>
              <p className="font-semibold text-gray-900">Librarian</p>
              <p className="text-xs text-gray-500 mt-1">
                Manage the catalog, track overdue books, and view reader activity.
              </p>
            </div>
            {selected === "librarian" && (
              <span className="text-xs font-medium text-purple-600">Selected ✓</span>
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={!selected || submitting}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Setting up your account…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
