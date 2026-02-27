"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useAuthSWR } from "@/lib/swr";
import {
  api,
  type DashboardStats,
  type OverdueBorrowRecord,
  type ReaderWithBorrowCount,
  type PendingReturnRecord,
  type EmbeddingGenerationResult,
  type CSVImportResult,
  type BookRequest,
} from "@/lib/api";
import Link from "next/link";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysOverdue(dueDateIso: string): number {
  const now = new Date();
  const due = new Date(dueDateIso);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
}

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className={`rounded-xl p-6 text-white ${colorClass}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-4xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function LibrarianDashboardPage() {
  const { getToken } = useAuth();

  // SWR: each data section has its own cache key — actions revalidate only what changed
  const { data: stats, mutate: mutateStats } = useAuthSWR<DashboardStats>("/api/librarian/dashboard");
  const { data: overdue } = useAuthSWR<OverdueBorrowRecord[]>("/api/borrow/overdue");
  const { data: readers } = useAuthSWR<ReaderWithBorrowCount[]>("/api/librarian/readers");
  const { data: pendingReturns, mutate: mutatePendingReturns } = useAuthSWR<PendingReturnRecord[]>("/api/librarian/pending-returns");
  const { data: pendingCheckouts, mutate: mutatePendingCheckouts } = useAuthSWR<PendingReturnRecord[]>("/api/librarian/pending-checkouts");
  const { data: bookRequests, mutate: mutateBookRequests } = useAuthSWR<BookRequest[]>("/api/librarian/book-requests?status=pending");

  const isLoading = !stats;

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embeddingResult, setEmbeddingResult] = useState<EmbeddingGenerationResult | null>(null);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [csvResult, setCsvResult] = useState<CSVImportResult | null>(null);
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Librarian Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <StatCard label="Total Books" value={stats.total_books} colorClass="bg-indigo-600" />
          <StatCard label="Checked Out" value={stats.total_checked_out} colorClass="bg-yellow-500" />
          <StatCard label="Overdue" value={stats.total_overdue} colorClass="bg-red-500" />
          <StatCard label="Pending Returns" value={stats.total_pending_returns} colorClass="bg-orange-500" />
          <StatCard label="Book Requests" value={stats.total_pending_requests} colorClass="bg-purple-500" />
          <StatCard label="Readers" value={stats.total_readers} colorClass="bg-green-600" />
        </div>
      )}

      {/* AI Tools & Import */}
      <section className="mb-10 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px] p-5 bg-white border border-gray-200 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-2">Generate Book Embeddings</h3>
          <p className="text-sm text-gray-500 mb-3">
            Generate AI embeddings for books that don&apos;t have them yet. Required for personalized recommendations.
          </p>
          <button
            onClick={async () => {
              setIsGeneratingEmbeddings(true);
              setEmbeddingResult(null);
              try {
                const token = await getToken();
                if (!token) return;
                const result = await api.generateEmbeddings(token);
                setEmbeddingResult(result);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to generate embeddings");
              } finally {
                setIsGeneratingEmbeddings(false);
              }
            }}
            disabled={isGeneratingEmbeddings}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
          >
            {isGeneratingEmbeddings ? "Generating…" : "Generate Embeddings"}
          </button>
          {embeddingResult && (
            <p className="mt-2 text-sm text-green-600">{embeddingResult.message}</p>
          )}
        </div>

        <div className="flex-1 min-w-[300px] p-5 bg-white border border-gray-200 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-2">Import Books from CSV</h3>
          <p className="text-sm text-gray-500 mb-3">
            Upload a CSV with columns: title, author, isbn, genre, description, cover_url, published_year, total_copies.
          </p>
          <input
            type="file"
            accept=".csv"
            disabled={isImportingCSV}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsImportingCSV(true);
              setCsvResult(null);
              try {
                const token = await getToken();
                if (!token) return;
                const result = await api.importBooksCSV(token, file);
                setCsvResult(result);
                // Revalidate dashboard stats via SWR
                mutateStats();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to import CSV");
              } finally {
                setIsImportingCSV(false);
                e.target.value = "";
              }
            }}
            className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
          />
          {isImportingCSV && <p className="mt-2 text-sm text-gray-500">Importing…</p>}
          {csvResult && (
            <div className="mt-2 text-sm">
              <p className="text-green-600">Imported {csvResult.imported} book(s).</p>
              {csvResult.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="text-red-600 cursor-pointer">{csvResult.errors.length} error(s)</summary>
                  <ul className="mt-1 space-y-0.5 text-red-500 text-xs">
                    {csvResult.errors.map((err, i) => (
                      <li key={i}>Row {err.row}: {err.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Pending Returns */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Returns</h2>
        {(pendingReturns ?? []).length === 0 ? (
          <p className="text-gray-500 italic text-sm">No pending return requests.</p>
        ) : (
          <div className="space-y-3">
            {(pendingReturns ?? []).map((record) => (
              <div
                key={record.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {record.book?.title ?? "Unknown title"}
                  </p>
                  <p className="text-sm text-gray-600">{record.book?.author ?? "Unknown author"}</p>
                </div>
                <div className="text-sm text-gray-600 sm:text-right">
                  <p>
                    {record.user?.name ?? record.user?.email ?? "Unknown user"}
                    {record.user?.name && (
                      <span className="text-gray-400 ml-1">({record.user.email})</span>
                    )}
                  </p>
                  <p className="text-gray-500">
                    Due: {formatDate(record.due_date)}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setApprovingId(record.id);
                    try {
                      const token = await getToken();
                      if (!token) return;
                      await api.approveReturn(token, record.id);
                      // Optimistically remove from list & revalidate stats
                      mutatePendingReturns((prev) => prev?.filter((r) => r.id !== record.id), false);
                      mutateStats();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to approve return");
                    } finally {
                      setApprovingId(null);
                    }
                  }}
                  disabled={approvingId === record.id}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {approvingId === record.id ? "Approving…" : "Approve Return"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Book Requests */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Book Requests</h2>
        {(bookRequests ?? []).length === 0 ? (
          <p className="text-gray-500 italic text-sm">No pending book requests.</p>
        ) : (
          <div className="space-y-3">
            {(bookRequests ?? []).map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{req.title}</p>
                    {req.author && <p className="text-sm text-gray-600">by {req.author}</p>}
                    {req.reason && (
                      <p className="text-sm text-gray-500 mt-1 italic">&quot;{req.reason}&quot;</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 sm:text-right">
                    <p>{req.requester_name || req.requester_email || "Unknown"}</p>
                    <p className="text-gray-400">{formatDate(req.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Optional note..."
                    value={reviewNote[req.id] || ""}
                    onChange={(e) =>
                      setReviewNote((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={async () => {
                      setReviewingId(req.id);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        await api.reviewBookRequest(
                          token,
                          req.id,
                          "approve",
                          reviewNote[req.id] || undefined
                        );
                        mutateBookRequests((prev) => prev?.filter((r) => r.id !== req.id), false);
                        mutateStats();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to approve request");
                      } finally {
                        setReviewingId(null);
                      }
                    }}
                    disabled={reviewingId === req.id}
                    className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 flex-shrink-0"
                  >
                    {reviewingId === req.id ? "..." : "Approve & Add"}
                  </button>
                  <button
                    onClick={async () => {
                      setReviewingId(req.id);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        await api.reviewBookRequest(
                          token,
                          req.id,
                          "reject",
                          reviewNote[req.id] || undefined
                        );
                        mutateBookRequests((prev) => prev?.filter((r) => r.id !== req.id), false);
                        mutateStats();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to reject request");
                      } finally {
                        setReviewingId(null);
                      }
                    }}
                    disabled={reviewingId === req.id}
                    className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-60 flex-shrink-0"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending Checkouts */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Checkouts</h2>
        {(pendingCheckouts ?? []).length === 0 ? (
          <p className="text-gray-500 italic text-sm">No pending checkout requests.</p>
        ) : (
          <div className="space-y-3">
            {(pendingCheckouts ?? []).map((record) => (
              <div
                key={record.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {record.book?.title ?? "Unknown title"}
                  </p>
                  <p className="text-sm text-gray-600">{record.book?.author ?? "Unknown author"}</p>
                </div>
                <div className="text-sm text-gray-600 sm:text-right">
                  <p>
                    {record.user?.name ?? record.user?.email ?? "Unknown user"}
                    {record.user?.name && (
                      <span className="text-gray-400 ml-1">({record.user.email})</span>
                    )}
                  </p>
                  <p className="text-gray-500">
                    Requested: {formatDate(record.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={async () => {
                      setApprovingId(record.id);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        await api.approveCheckout(token, record.id);
                        mutatePendingCheckouts((prev) => prev?.filter((r) => r.id !== record.id), false);
                        mutateStats();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to approve checkout");
                      } finally {
                        setApprovingId(null);
                      }
                    }}
                    disabled={approvingId === record.id || rejectingId === record.id}
                    className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                  >
                    {approvingId === record.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={async () => {
                      setRejectingId(record.id);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        await api.rejectCheckout(token, record.id);
                        mutatePendingCheckouts((prev) => prev?.filter((r) => r.id !== record.id), false);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to reject checkout");
                      } finally {
                        setRejectingId(null);
                      }
                    }}
                    disabled={approvingId === record.id || rejectingId === record.id}
                    className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-60"
                  >
                    {rejectingId === record.id ? "Rejecting…" : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Overdue records */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overdue Books</h2>
        {(overdue ?? []).length === 0 ? (
          <p className="text-gray-500 italic text-sm">No overdue records.</p>
        ) : (
          <div className="space-y-3">
            {(overdue ?? []).map((record) => (
              <div
                key={record.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {record.book?.title ?? "Unknown title"}
                  </p>
                  <p className="text-sm text-gray-600">{record.book?.author ?? "Unknown author"}</p>
                </div>
                <div className="text-sm text-gray-600 sm:text-right">
                  <p>
                    {record.user?.name ?? record.user?.email ?? "Unknown user"}
                    {record.user?.name && (
                      <span className="text-gray-400 ml-1">({record.user.email})</span>
                    )}
                  </p>
                  <p className="text-red-600 font-medium">
                    {daysOverdue(record.due_date)} day{daysOverdue(record.due_date) !== 1 ? "s" : ""} overdue
                    <span className="text-gray-400 font-normal ml-1">(due {formatDate(record.due_date)})</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Readers table */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Readers</h2>
        {(readers ?? []).length === 0 ? (
          <p className="text-gray-500 italic text-sm">No readers registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Name / Email</th>
                  <th className="pb-3 pr-4 font-medium text-center">Active Borrows</th>
                  <th className="pb-3 pr-4 font-medium text-center">Total Borrows</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(readers ?? []).map((reader) => (
                  <tr key={reader.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{reader.name ?? "—"}</p>
                      <p className="text-gray-500">{reader.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-medium ${
                          reader.active_borrow_count > 0
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {reader.active_borrow_count}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-700">
                      {reader.total_borrow_count}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/librarian/readers/${reader.id}`}
                        className="text-indigo-600 hover:underline text-sm"
                      >
                        View history
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
