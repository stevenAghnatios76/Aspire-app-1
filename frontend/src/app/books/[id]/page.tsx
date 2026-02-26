"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type Book, type BorrowRecord } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import SimilarBooks from "@/components/SimilarBooks";
import AIBookSummary from "@/components/AIBookSummary";

export default function BookDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { getToken, isLibrarian } = useAuth();
	const router = useRouter();
	const [book, setBook] = useState<Book | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeBorrow, setActiveBorrow] = useState<BorrowRecord | null>(null);
	const [isBorrowing, setIsBorrowing] = useState(false);
	const [borrowError, setBorrowError] = useState<string | null>(null);
	const [borrowSuccess, setBorrowSuccess] = useState(false);

	const fetchBook = useCallback(async () => {
		try {
			const token = await getToken();
			if (!token) return;
			const [data, history] = await Promise.all([
				api.getBook(token, id),
				api.getMyHistory(token),
			]);
			setBook(data);
			const active = history.find(
				(r) =>
					r.book_id === id &&
					(r.status === "pending" ||
						r.status === "active" ||
						r.status === "overdue" ||
						r.status === "pending_return"),
			);
			setActiveBorrow(active ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load book");
		} finally {
			setIsLoading(false);
		}
	}, [id, getToken]);

	useEffect(() => {
		fetchBook();
	}, [fetchBook]);

	const handleBorrow = async () => {
		setIsBorrowing(true);
		setBorrowError(null);
		setBorrowSuccess(false);
		try {
			const token = await getToken();
			if (!token) return;
			const record = await api.borrowBook(token, id);
			setActiveBorrow(record);
			setBorrowSuccess(true);
			const updated = await api.getBook(token, id);
			setBook(updated);
		} catch (err) {
			setBorrowError(
				err instanceof Error ? err.message : "Failed to borrow book",
			);
		} finally {
			setIsBorrowing(false);
		}
	};

	const handleDelete = async () => {
		if (!book || !confirm("Are you sure you want to delete this book?")) return;
		try {
			const token = await getToken();
			if (!token) return;
			await api.deleteBook(token, book.id);
			router.push("/books");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete book");
		}
	};

	if (isLoading) {
		return (
			<div className="max-w-4xl mx-auto px-6 py-12 flex justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
			</div>
		);
	}

	if (error || !book) {
		return (
			<div className="max-w-4xl mx-auto px-6 py-12 text-center">
				<p className="text-red-600">{error || "Book not found"}</p>
				<Link
					href="/books"
					className="text-indigo-600 hover:underline text-sm mt-4 inline-block"
				>
					← Back to catalog
				</Link>
			</div>
		);
	}

	const statusStyles: Record<string, string> = {
		available: "bg-green-100 text-green-700",
		checked_out: "bg-yellow-100 text-yellow-700",
		unavailable: "bg-red-100 text-red-700",
	};

	return (
		<div className="max-w-4xl mx-auto px-6 py-8">
			<Link
				href="/books"
				className="text-indigo-600 hover:underline text-sm mb-6 inline-block"
			>
				← Back to catalog
			</Link>

			<div className="flex flex-col md:flex-row gap-8">
				{/* Cover */}
				<div className="w-full md:w-64 flex-shrink-0">
					<div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
						{book.cover_url ? (
							<img
								src={book.cover_url}
								alt={book.title}
								className="w-full h-full object-cover"
							/>
						) : (
							<span className="text-6xl">📖</span>
						)}
					</div>
				</div>

				{/* Details */}
				<div className="flex-1">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						{book.title}
					</h1>
					<p className="text-lg text-gray-600 mb-4">by {book.author}</p>

					<div className="flex flex-wrap gap-3 mb-6">
						<span
							className={`text-sm px-3 py-1 rounded-full font-medium ${statusStyles[book.status]}`}
						>
							{book.status.replace("_", " ")}
						</span>
						{book.genre && (
							<span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700">
								{book.genre}
							</span>
						)}
						{book.published_year && (
							<span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700">
								{book.published_year}
							</span>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4 mb-6 text-sm">
						{book.isbn && (
							<div>
								<span className="text-gray-500">ISBN:</span>{" "}
								<span className="text-gray-900">{book.isbn}</span>
							</div>
						)}
						<div>
							<span className="text-gray-500">Copies:</span>{" "}
							<span className="text-gray-900">
								{book.available_copies} of {book.total_copies} available
							</span>
						</div>
					</div>

					{book.description && (
						<div className="mb-6">
							<h2 className="text-sm font-semibold text-gray-900 mb-2">
								Description
							</h2>
							<p className="text-gray-600 text-sm leading-relaxed">
								{book.description}
							</p>
						</div>
					)}
					{/* Actions */}
					<div className="flex flex-col gap-3">
						{/* AI Summary */}
						<AIBookSummary bookId={id} />
						<div className="flex gap-3">
							{!isLibrarian && book.available_copies > 0 && !activeBorrow && (
								<button
									onClick={handleBorrow}
									disabled={isBorrowing}
									className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
								>
									{isBorrowing ? "Borrowing…" : "Borrow this Book"}
								</button>
							)}
							{!isLibrarian && activeBorrow && (
								<span className="px-6 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium">
									{activeBorrow.status === "pending"
										? "Checkout pending approval"
										: activeBorrow.status === "pending_return"
											? "Return pending approval"
											: "Already borrowed"}
								</span>
							)}
							{isLibrarian && (
								<>
									<Link
										href={`/librarian/books/${book.id}/edit`}
										className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
									>
										Edit
									</Link>
									<button
										onClick={handleDelete}
										className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
									>
										Delete
									</button>
								</>
							)}
						</div>
						{borrowSuccess && (
							<p className="text-sm text-green-600">
								Checkout requested! Awaiting librarian approval.
							</p>
						)}
						{borrowError && (
							<p className="text-sm text-red-600">{borrowError}</p>
						)}
					</div>
				</div>
			</div>

			{/* Similar books powered by pgvector embeddings */}
			<SimilarBooks bookId={id} />
		</div>
	);
}
