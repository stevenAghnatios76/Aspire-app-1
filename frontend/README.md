# Frontend (Next.js)

For full project setup, production deployment notes, API catalog, and complete feature test walkthroughs, use the root README:

- `../README.md`

## Local Frontend Commands

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

## Required Environment Variables

Create `frontend/.env.local` from `frontend/.env.local.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
