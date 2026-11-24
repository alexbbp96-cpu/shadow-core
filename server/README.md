# SHADOW CORE Backend 1.0

Express API + Supabase PostgreSQL for the SHADOW LEDGER.

## Setup

1. Create a Supabase project.
2. Run `server/migrations/001_shadow_ledger.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and fill Supabase credentials.
4. `npm install --legacy-peer-deps`
5. `npm run server`

## Endpoints

- `POST /api/v1/transactions` — ingest (operator)
- `GET /api/v1/transactions` — list
- `GET /api/v1/transactions/:id` — detail
- `POST /api/v1/transactions/:id/review` — human review
- `GET /api/v1/audit-events` — audit log
- `GET /health`

All `/api/v1/*` require `Authorization: Bearer <supabase-jwt>`.

Roles: `viewer`, `operator`, `auditor`, `system` (set in Supabase user metadata).

**Does not move funds or connect to real banks.**
