"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useAuthSWR } from "@/lib/swr";
import { api, type Book, type BookUpdateInput } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function EditBookPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SWR fetches the book — shares cache with the detail page
  const { data: bookData, isLoading } = useAuthSWR<Book>(`/api/books/${id}`);

  const [form, setForm] = useState<BookUpdateInput>({
    title: "",
    author: "",
    isbn: "",
    genre: "",
    description: "",
    cover_url: "",
    published_year: undefined,
    total_copies: 1,
    available_copies: 1,
    status: "available",
  });

  // Populate form once SWR data arrives
  useEffect(() => {
    if (bookData) {
      setForm({
        title: bookData.title,
        author: bookData.author,
        isbn: bookData.isbn || "",
        genre: bookData.genre || "",
        description: bookData.description || "",
        cover_url: bookData.cover_url || "",
        published_year: bookData.published_year || undefined,
        total_copies: bookData.total_copies,
        available_copies: bookData.available_copies,
        status: bookData.status,
      });
    }
  }, [bookData]);

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

      const data: BookUpdateInput = {};
      if (form.title) data.title = form.title;
      if (form.author) data.author = form.author;
      if (form.isbn) data.isbn = form.isbn;
      if (form.genre) data.genre = form.genre;
      if (form.description) data.description = form.description;
      if (form.cover_url) data.cover_url = form.cover_url;
      if (form.published_year) data.published_year = form.published_year;
      if (form.total_copies !== undefined) data.total_copies = form.total_copies;
      if (form.available_copies !== undefined) data.available_copies = form.available_copies;
      if (form.status) data.status = form.status;

      await api.updateBook(token, id, data);
      router.push(`/books/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update book");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href={`/books/${id}`} className="text-indigo-600 hover:underline text-sm mb-6 inline-block">
        ← Back to book
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Book</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={form.title || ""}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <input
              type="text"
              name="author"
              value={form.author || ""}
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Available</label>
            <input
              type="number"
              name="available_copies"
              value={form.available_copies ?? ""}
              onChange={handleChange}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={form.status || "available"}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="available">Available</option>
              <option value="checked_out">Checked Out</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/books/${id}`}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
