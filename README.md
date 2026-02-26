# Mini Library Management System

A full-stack library management system with AI-powered book recommendations.

## Tech Stack

| Layer      | Choice                                    |
|------------|-------------------------------------------|
| Frontend   | Next.js 14 (App Router) + Tailwind CSS    |
| Backend    | Python / FastAPI                          |
| Auth       | Supabase Auth (Google OAuth SSO)          |
| Database   | Supabase PostgreSQL + pgvector            |
| AI         | LangChain + OpenAI Embeddings + Google Books API |

## Project Structure

```
├── frontend/          # Next.js 14 App Router
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/# React components
│       └── lib/       # Supabase clients, API helpers
├── backend/           # FastAPI
│   └── app/
│       ├── core/      # Config, auth, Supabase client
│       ├── routers/   # API route handlers
│       ├── schemas/   # Pydantic models
│       └── services/  # Business logic
├── supabase/          # Database migrations & seeds
│   ├── migrations/
│   ├── seed_books.sql
│   └── promote_librarian.sql
├── ms1-foundation.md     # Milestone 1 spec
├── ms2-core-features.md  # Milestone 2 spec
└── ms3-ai-features.md    # Milestone 3 spec
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- A [Supabase](https://supabase.com) project

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/seed_books.sql` to insert sample books
4. Go to **Authentication → Providers** and enable **Google** OAuth
5. Set the redirect URL to `http://localhost:3000/auth/callback`
6. Copy your project URL, anon key, service role key, and JWT secret

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install PyJWT

# Create .env from example
cp .env.example .env
# Edit .env with your Supabase credentials

# Run the server (make sure you're in the backend directory with venv activated)
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install

# Create .env.local from example
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run the dev server
npm run dev
```

### 4. Promote a User to Librarian

After signing in with Google, run this in Supabase SQL Editor:

```sql
UPDATE public.users SET role = 'librarian' WHERE email = 'your-email@example.com';
```

## API Endpoints

| Method | Endpoint              | Auth      | Description              |
|--------|-----------------------|-----------|--------------------------|
| GET    | `/api/books`          | Required  | List books (paginated)   |
| GET    | `/api/books/{id}`     | Required  | Get single book          |
| POST   | `/api/books`          | Librarian | Create book              |
| PUT    | `/api/books/{id}`     | Librarian | Update book              |
| DELETE | `/api/books/{id}`     | Librarian | Delete book              |
| GET    | `/api/books/search`   | Required  | Search books             |
| GET    | `/api/auth/me`        | Required  | Get current user profile |

## Milestones

- **MS1** ✅ Foundation: scaffolding, auth, book CRUD
- **MS2** Borrow flow, search, dashboard, reader history
- **MS3** AI recommendations (Google Books + pgvector)
