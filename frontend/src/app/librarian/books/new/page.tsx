"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type BookCreateInput } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewBookPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<BookCreateInput>({
    title: "",
    author: "",
    isbn: "",
    genre: "",
    description: "",
    cover_url: "",
    published_year: undefined,
    total_copies: 1,
    available_copies: 1,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "published_year" || name === "total_copies" || name === "available_copies"
          ? value
            ? parseInt(value)
            : undefined
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      // Clean up empty strings → undefined
      const data: BookCreateInput = {
        title: form.title,
        author: form.author,
        ...(form.isbn ? { isbn: form.isbn } : {}),
        ...(form.genre ? { genre: form.genre } : {}),
        ...(form.description ? { description: form.description } : {}),
        ...(form.cover_url ? { cover_url: form.cover_url } : {}),
        ...(form.published_year ? { published_year: form.published_year } : {}),
        total_copies: form.total_copies || 1,
        available_copies: form.available_copies ?? form.total_copies ?? 1,
      };

      const book = await api.createBook(token, data);
      router.push(`/books/${book.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create book");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/books" className="text-indigo-600 hover:underline text-sm mb-6 inline-block">
        ← Back to catalog
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Book</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Author <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="author"
              value={form.author}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
            <input
              type="text"
              name="isbn"
              value={form.isbn || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
            <select
              name="genre"
              value={form.genre || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select genre</option>
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
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={form.description || ""}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
          <input
            type="url"
            name="cover_url"
            value={form.cover_url || ""}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Published Year</label>
            <input
              type="number"
              name="published_year"
              value={form.published_year || ""}
              onChange={handleChange}
              min={1000}
              max={2100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Copies</label>
            <input
              type="number"
              name="total_copies"
              value={form.total_copies || ""}
              onChange={handleChange}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Available Copies</label>
            <input
              type="number"
              name="available_copies"
              value={form.available_copies ?? ""}
              onChange={handleChange}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Book"}
          </button>
          <Link
            href="/books"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
