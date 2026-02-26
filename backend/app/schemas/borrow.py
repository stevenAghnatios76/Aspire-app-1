from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BorrowRequest(BaseModel):
    book_id: str


class ReturnRequest(BaseModel):
    borrow_record_id: str


class BookSummary(BaseModel):
    id: str
    title: str
    author: str
    cover_url: Optional[str] = None


class UserSummary(BaseModel):
    id: str
    name: Optional[str] = None
    email: str
    avatar_url: Optional[str] = None


class BorrowRecordResponse(BaseModel):
    id: str
    user_id: str
    book_id: str
    borrowed_at: datetime
    due_date: datetime
    returned_at: Optional[datetime] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class BorrowHistoryItem(BorrowRecordResponse):
    book: Optional[BookSummary] = None


class OverdueBorrowRecord(BorrowRecordResponse):
    book: Optional[BookSummary] = None
    user: Optional[UserSummary] = None


class PendingReturnRecord(BorrowRecordResponse):
    book: Optional[BookSummary] = None
    user: Optional[UserSummary] = None


class DashboardStats(BaseModel):
    total_books: int
    total_checked_out: int
    total_overdue: int
    total_readers: int
    total_pending_returns: int = 0


class ReaderWithBorrowCount(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    active_borrow_count: int
    total_borrow_count: int
