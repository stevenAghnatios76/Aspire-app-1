"use client";

import { useParams } from "next/navigation";
import { useAuthSWR } from "@/lib/swr";
import { type BorrowHistoryItem, type ReaderWithBorrowCount } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import ReaderRecommendations from "@/components/ReaderRecommendations";

const statusStyles: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  active: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  returned: "bg-green-100 text-green-700",
  pending_return: "bg-yellow-100 text-yellow-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReaderHistoryPage() {
  const { id } = useParams<{ id: string }>();

  // SWR: both requests are cached and deduplicated
  const { data: reader, error: readerError, isLoading: readerLoading } = useAuthSWR<ReaderWithBorrowCount>(
    `/api/librarian/readers/${id}`
  );
  const { data: history, error: historyError, isLoading: historyLoading } = useAuthSWR<BorrowHistoryItem[]>(
    `/api/librarian/readers/${id}/history`
  );

  const isLoading = readerLoading || historyLoading;
  const error = readerError || historyError;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/librarian/dashboard"
        className="text-indigo-600 hover:underline text-sm mb-6 inline-block"
      >
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reader Borrow History</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error.message}
        </div>
      )}

      {/* Reader profile info */}
      {reader && (
        <div className="mb-8 p-5 bg-white border border-gray-200 rounded-xl flex items-center gap-4">
          {reader.avatar_url ? (
            <Image
              src={reader.avatar_url}
              alt=""
              width={56}
              height={56}
              className="w-14 h-14 rounded-full"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
              👤
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-lg">{reader.name ?? "—"}</p>
            <p className="text-gray-500 text-sm">{reader.email}</p>
          </div>
          <div className="flex gap-6 text-center flex-shrink-0">
            <div>
              <p className="text-2xl font-bold text-yellow-600">{reader.active_borrow_count}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{reader.total_borrow_count}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {reader && <ReaderRecommendations userId={id} />}

      {!history || history.length === 0 ? (
        <p className="text-gray-500 italic">This reader has no borrow history.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 pr-4 font-medium">Book</th>
                <th className="pb-3 pr-4 font-medium">Borrowed</th>
                <th className="pb-3 pr-4 font-medium">Due</th>
                <th className="pb-3 pr-4 font-medium">Returned</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900">
                      {record.book?.title ?? "Unknown title"}
                    </p>
                    <p className="text-gray-500">{record.book?.author ?? "Unknown author"}</p>
                  </td>
                  <td className="py-3 pr-4 text-gray-700">{formatDate(record.borrowed_at)}</td>
                  <td className="py-3 pr-4 text-gray-700">{formatDate(record.due_date)}</td>
                  <td className="py-3 pr-4 text-gray-500">
                    {record.returned_at ? formatDate(record.returned_at) : "—"}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[record.status]}`}
                    >
                      {record.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
