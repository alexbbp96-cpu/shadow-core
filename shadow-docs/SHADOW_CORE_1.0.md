# SHADOW CORE 1.0 — MONITOR + CONTROL

## Purpose
SHADOW CORE is a monitoring and review layer around the existing TAX-BOT application. Version 1.0 records transaction metadata, validates input, detects configured review conditions, and writes audit events. It does not initiate, approve, reject, freeze, or transfer funds.

## Existing TAX-BOT preserved
- Existing React/Vite interface remains the current frontend.
- Existing progressive tax calculation remains in `src/lib/taxEngine.ts`.
- The tax schedule is not changed by this integration scaffold.
- No tax result is automatically attached to a transaction until currency, jurisdiction, taxable-event rules, and the meaning of the existing `c` unit are explicitly defined.

## Monitoring flow
1. Receive transaction metadata from a trusted source or a test fixture.
2. Validate required fields and amount representation.
3. Enforce idempotency on `(source, external_id)`.
4. Evaluate configured monitoring rules.
5. Persist the transaction and append audit events.
6. Route flagged transactions to a human review queue.

## Initial review flags
- `MISSING_COUNTERPARTY`
- `FUTURE_DATED`
- `LARGE_AMOUNT` (only when an operator configures a threshold)
- `UNSUPPORTED_CURRENCY` (based on an explicit allow-list)
- `DUPLICATE_EXTERNAL_ID` is rejected at ingestion and should also be protected by a database unique constraint.

These are operational review signals, not determinations of fraud, illegality, or tax liability.

## Data contract
Amounts are positive integer minor units (for example, cents or agorot), never floating-point currency values. Currency is a three-letter uppercase code. Store timestamps in UTC. Do not store bank credentials, card numbers, authentication secrets, or full payment credentials in this ledger.

## Provider-neutral database
`schema.sql` defines PostgreSQL tables for transactions and append-only audit events. It is a proposed schema, not a deployed database. The selected hosting/database provider remains undecided.

## API contract to implement after provider selection
- `POST /api/v1/transactions` — ingest transaction metadata; return validation errors or the recorded transaction plus review flags.
- `GET /api/v1/transactions` — authenticated, paginated list with filters.
- `GET /api/v1/transactions/:id` — authenticated transaction detail and associated flags.
- `GET /api/v1/audit-events` — authenticated, read-only audit history.
- `POST /api/v1/transactions/:id/review` — record a human review decision and reviewer identity; must not move funds.

All endpoints require authentication, authorization, rate limiting, input-size limits, structured logging, and secrets management before deployment. Provider webhooks must be signature-verified and idempotent. No public endpoint should accept arbitrary claims that a transfer is bank-confirmed.

## Deployment gates
1. Select hosting and PostgreSQL provider.
2. Implement authenticated API and database repository.
3. Add automated tests and migrations.
4. Threat-model access, audit integrity, retention, backups, and privacy.
5. Test with synthetic transactions only.
6. Obtain authorized bank/payment-provider API access and verify local legal/compliance requirements before any live-data integration.
