const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...rest,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "An unexpected error occurred",
    }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ---------- Book types ----------

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  genre: string | null;
  description: string | null;
  cover_url: string | null;
  published_year: number | null;
  total_copies: number;
  available_copies: number;
  status: "available" | "checked_out" | "unavailable";
  created_at: string;
  relevance?: number;
}

export interface PaginatedBooks {
  data: Book[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface BookCreateInput {
  title: string;
  author: string;
  isbn?: string;
  genre?: string;
  description?: string;
  cover_url?: string;
  published_year?: number;
  total_copies?: number;
  available_copies?: number;
}

export interface BookUpdateInput extends Partial<BookCreateInput> {
  status?: "available" | "checked_out" | "unavailable";
}

// ---------- User types ----------

export interface User {
  id: string;
  email: string;
  role: "librarian" | "reader";
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// ---------- Borrow types ----------

export interface BorrowRecord {
  id: string;
  user_id: string;
  book_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: "pending" | "active" | "overdue" | "returned" | "pending_return";
  created_at: string;
}

export interface BorrowHistoryItem extends BorrowRecord {
  book: { id: string; title: string; author: string; cover_url: string | null } | null;
}

export interface OverdueBorrowRecord extends BorrowRecord {
  book: { id: string; title: string; author: string; cover_url: string | null } | null;
  user: { id: string; name: string | null; email: string; avatar_url: string | null } | null;
}

export interface PendingReturnRecord extends BorrowRecord {
  book: { id: string; title: string; author: string; cover_url: string | null } | null;
  user: { id: string; name: string | null; email: string; avatar_url: string | null } | null;
}

export interface DashboardStats {
  total_books: number;
  total_checked_out: number;
  total_overdue: number;
  total_readers: number;
  total_pending_returns: number;
  total_pending_requests: number;
}

export interface ReaderWithBorrowCount {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  active_borrow_count: number;
  total_borrow_count: number;
}

// ---------- Similar / Recommendation types ----------

export interface SimilarBook {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  similarity: number;
}

export interface BookRecommendation {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  cover_url: string | null;
  similarity: number;
}

export interface RecommendationResponse {
  books: BookRecommendation[];
  message: string | null;
}

export interface EmbeddingGenerationResult {
  processed: number;
  message: string;
}

export interface CSVImportResult {
  imported: number;
  errors: { row: number; reason: string }[];
}

// ---------- Book Summary types ----------

export interface BookSummaryResponse {
  book_id: string;
  summary: string;
  generated_at: string;
  cached: boolean;
}

// ---------- Discovery types ----------

export interface DiscoveredBook {
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  source_url: string | null;
  isbn: string | null;
  relevance_reason: string | null;
  in_catalog: boolean;
  catalog_book_id: string | null;
  available_copies: number | null;
}

export interface DiscoveryResponse {
  books: DiscoveredBook[];
  intent: Record<string, unknown>;
  total: number;
}

// ---------- Book Request types ----------

export interface BookRequest {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  cover_url: string | null;
  source_url: string | null;
  description: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  librarian_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  requester_name: string | null;
  requester_email: string | null;
}

// ---------- API functions ----------

export const api = {
  // Auth
  getMe: (token: string) => apiFetch<User>("/api/auth/me", { token }),

  setupUser: (token: string, role: "reader" | "librarian") =>
    apiFetch<User>("/api/auth/setup", {
      token,
      method: "POST",
      body: JSON.stringify({ role }),
    }),

  // Books
  listBooks: (token: string, page = 1, limit = 20) =>
    apiFetch<PaginatedBooks>(`/api/books?page=${page}&limit=${limit}`, {
      token,
    }),

  getBook: (token: string, id: string) =>
    apiFetch<Book>(`/api/books/${id}`, { token }),

  createBook: (token: string, data: BookCreateInput) =>
    apiFetch<Book>("/api/books", {
      token,
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBook: (token: string, id: string, data: BookUpdateInput) =>
    apiFetch<Book>(`/api/books/${id}`, {
      token,
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteBook: (token: string, id: string) =>
    apiFetch<void>(`/api/books/${id}`, {
      token,
      method: "DELETE",
    }),

  // Borrow
  borrowBook: (token: string, book_id: string) =>
    apiFetch<BorrowRecord>("/api/borrow", {
      token,
      method: "POST",
      body: JSON.stringify({ book_id }),
    }),

  returnBook: (token: string, borrow_record_id: string) =>
    apiFetch<BorrowRecord>("/api/borrow/return", {
      token,
      method: "POST",
      body: JSON.stringify({ borrow_record_id }),
    }),

  getMyHistory: (token: string) =>
    apiFetch<BorrowHistoryItem[]>("/api/borrow/history", { token }),

  getActiveBorrow: (token: string, bookId: string) =>
    apiFetch<BorrowRecord | null>(`/api/borrow/active?book_id=${bookId}`, { token }),

  getOverdueRecords: (token: string) =>
    apiFetch<OverdueBorrowRecord[]>("/api/borrow/overdue", { token }),

  // Librarian
  getDashboard: (token: string) =>
    apiFetch<DashboardStats>("/api/librarian/dashboard", { token }),

  getReaders: (token: string) =>
    apiFetch<ReaderWithBorrowCount[]>("/api/librarian/readers", { token }),

  getReader: (token: string, user_id: string) =>
    apiFetch<ReaderWithBorrowCount>(`/api/librarian/readers/${user_id}`, { token }),

  getReaderHistory: (token: string, user_id: string) =>
    apiFetch<BorrowHistoryItem[]>(`/api/librarian/readers/${user_id}/history`, { token }),

  getPendingReturns: (token: string) =>
    apiFetch<PendingReturnRecord[]>("/api/librarian/pending-returns", { token }),

  approveReturn: (token: string, borrow_record_id: string) =>
    apiFetch<BorrowRecord>("/api/librarian/approve-return", {
      token,
      method: "POST",
      body: JSON.stringify({ borrow_record_id }),
    }),

  searchBooks: (
    token: string,
    params: {
      q?: string;
      genre?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set("q", params.q);
    if (params.genre) searchParams.set("genre", params.genre);
    if (params.status) searchParams.set("status", params.status);
    searchParams.set("page", String(params.page || 1));
    searchParams.set("limit", String(params.limit || 20));
    return apiFetch<PaginatedBooks>(
      `/api/books/search?${searchParams.toString()}`,
      { token }
    );
  },

  // Similar books (Google Books API)
  getSimilarBooks: (token: string, bookId: string) =>
    apiFetch<SimilarBook[]>(`/api/books/${bookId}/similar`, { token }),

  // Embeddings
  generateEmbeddings: (token: string) =>
    apiFetch<EmbeddingGenerationResult>("/api/books/generate-embeddings", {
      token,
      method: "POST",
    }),

  // Personalized recommendations
  getReaderRecommendations: (token: string, userId: string) =>
    apiFetch<RecommendationResponse>(
      `/api/librarian/readers/${userId}/recommendations`,
      { token }
    ),

  // CSV import
  importBooksCSV: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_URL}/api/books/import-csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "An unexpected error occurred",
      }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json() as Promise<CSVImportResult>;
  },

  // Checkout approval (librarian)
  getPendingCheckouts: (token: string) =>
    apiFetch<PendingReturnRecord[]>("/api/librarian/pending-checkouts", {
      token,
    }),

  approveCheckout: (token: string, borrowId: string) =>
    apiFetch<BorrowRecord>(`/api/librarian/borrow/${borrowId}/approve`, {
      token,
      method: "POST",
    }),

  rejectCheckout: (token: string, borrowId: string) =>
    apiFetch<void>(`/api/librarian/borrow/${borrowId}/reject`, {
      token,
      method: "POST",
    }),

  // Email recommendations
  sendRecommendationEmail: (token: string, userId: string) =>
    apiFetch<{ message: string }>(
      `/api/librarian/readers/${userId}/send-recommendations`,
      { token, method: "POST" }
    ),

  // AI Book Summary
  getBookSummary: (token: string, bookId: string) =>
    apiFetch<BookSummaryResponse>(`/api/books/${bookId}/summary`, { token }),

  // Smart Search
  smartSearchBooks: (
    token: string,
    params: {
      q?: string;
      genre?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set("q", params.q);
    if (params.genre) searchParams.set("genre", params.genre);
    if (params.status) searchParams.set("status", params.status);
    searchParams.set("page", String(params.page || 1));
    searchParams.set("limit", String(params.limit || 20));
    return apiFetch<PaginatedBooks>(
      `/api/books/smart-search?${searchParams.toString()}`,
      { token }
    );
  },

  // AI Book Discovery
  discoverBooks: (token: string, paragraph: string) =>
    apiFetch<DiscoveryResponse>("/api/books/discover", {
      token,
      method: "POST",
      body: JSON.stringify({ paragraph }),
    }),

  // Book Requests (reader)
  createBookRequest: (
    token: string,
    data: {
      title: string;
      author?: string;
      isbn?: string;
      cover_url?: string;
      source_url?: string;
      description?: string;
      reason?: string;
    }
  ) =>
    apiFetch<BookRequest>("/api/book-requests", {
      token,
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyBookRequests: (token: string) =>
    apiFetch<BookRequest[]>("/api/book-requests", { token }),

  // Book Requests (librarian)
  getLibrarianBookRequests: (token: string, status?: string) => {
    const params = status ? `?status=${status}` : "";
    return apiFetch<BookRequest[]>(`/api/librarian/book-requests${params}`, {
      token,
    });
  },

  reviewBookRequest: (
    token: string,
    requestId: string,
    action: "approve" | "reject",
    note?: string
  ) =>
    apiFetch<BookRequest>(
      `/api/librarian/book-requests/${requestId}/review`,
      {
        token,
        method: "POST",
        body: JSON.stringify({ action, note }),
      }
    ),
};
