from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.routers import books, search, auth, borrow, librarian

settings = get_settings()

app = FastAPI(
    title="Mini Library Management System",
    description="API for managing a mini library with AI-powered recommendations",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — search must be registered BEFORE books to avoid /search matching /{book_id}
app.include_router(search.router)
app.include_router(borrow.router)
app.include_router(librarian.router)
app.include_router(books.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {"message": "Mini Library Management System API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
