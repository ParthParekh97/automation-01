# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Multi-tenant AI CRM SaaS built with Next.js 14 App Router + Supabase. A **super admin** manages multiple **client** accounts; each client has their own leads, calls, emails, and conversations. All external APIs use raw `fetch()` — no SDK packages are added.

## Commands

```bash
npm run dev        # start dev server (localhost:3000)
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (no test suite exists yet)
```

## Architecture

### Auth & Multi-tenancy

- Supabase Auth drives authentication. `auth.uid()` = the client's UUID, which is also their `client_id` across all tables.
- Two Supabase clients in `src/lib/supabase/server.ts`:
  - `createClient()` — uses the anon key + user session (respects RLS)
  - `createAdminClient()` — uses the service role key (bypasses RLS, used in API routes and crons)
- Dashboard layout (`src/app/(dashboard)/layout.tsx`) guards all pages: redirects unauthenticated users to `/login`.
- RLS policies: `super_admin` role (set via `auth.jwt() ->> 'role'`) has full access; clients are scoped to rows where `client_id = auth.uid()`.

### Route Groups

```
src/app/
  (auth)/          # login, signup — public, no sidebar
  (dashboard)/     # all protected pages with sidebar layout
  api/             # all API routes (server-only)
```

### Data Flow Pattern

**Server pages** fetch data directly from Supabase (no API layer needed — they run server-side). **Client components** call API routes for mutations and real-time actions.

### Core Data Model (`supabase/migrations/`)

- `clients` → `leads` → `calls`, `emails`, `conversations`, `bookings` (all cascade-delete from clients)
- `client_integrations` — per-client OAuth tokens (Gmail). Tokens are AES-256-GCM encrypted before storage (`src/lib/encryption.ts`). Format: `base64url(iv).base64url(authTag).base64url(ciphertext)`
- `email_sequences` — 3-step drip sequences; `current_step` (0–3), `next_send_at` cursor, `replied` flag
- `conversations.messages` is a JSONB array of `{ id, role, content, timestamp, metadata? }` objects — **not** a separate table

### External Integrations (all raw fetch, no SDK)

| Service | Env vars | Where |
|---------|----------|-------|
| Vapi (AI voice calls) | `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET` | `src/app/api/calls/outbound/`, `src/app/api/webhooks/vapi/` |
| Gmail (OAuth 2.0) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `src/lib/gmail.ts`, `src/app/api/auth/gmail/` |
| Claude API | `ANTHROPIC_API_KEY` | `src/lib/claude.ts` — model `claude-sonnet-4-20250514` |
| Slack | `SLACK_WEBHOOK_URL` | `src/lib/slack.ts` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/` |

### Key Library Files

- `src/lib/gmail.ts` — `getValidAccessToken()` auto-refreshes tokens; `sendEmail()` builds RFC-2822 MIME; `parseMessage()` walks MIME parts recursively; `listHistory()` returns `null` on 404 (expired historyId)
- `src/lib/sequence.ts` — `startSequence()`, `processSequence()` (Claude → Gmail → DB), `cancelSequence()`, `markSequenceReplied()`
- `src/lib/claude.ts` — `generateSequenceEmail()` returns `{ subject, html }` JSON from Claude
- `src/lib/encryption.ts` — `encrypt(plaintext)` / `decrypt(encoded)` using `ENCRYPTION_KEY` (64-char hex)
- `src/lib/utils.ts` — `cn()`, `statusColor()`, `formatDate/DateTime/Duration()`

### Email Sequence Flow

1. New lead created with `status="new"` + email → `startSequence()` fires (non-blocking)
2. Vercel Cron (`*/30 * * * *`) hits `POST /api/cron/sequence-process` → finds rows where `status='active' AND replied=false AND next_send_at <= NOW()`
3. For each due row: Claude generates email → Gmail sends → `emails` table updated → `current_step` advanced, `next_send_at` set (step 2 = +3 days, step 3 = +7 days)
4. Gmail poll cron (`*/5 * * * *`) detects inbound reply → `markSequenceReplied()` cancels sequence
5. All 3 follow-ups share one Gmail thread via `threadId` + `In-Reply-To`

### Gmail Poll Cron

`POST /api/cron/gmail-poll` iterates all active Gmail integrations. Uses `history.list` with `gmail_history_id` cursor; falls back to `is:unread in:inbox newer_than:2d` search when historyId expired (404). Deduplicates via `gmail_message_id` unique constraint.

### Vapi Webhook

`POST /api/webhooks/vapi` — verifies `x-vapi-secret` header, processes `end-of-call-report` events. Normalises phone to E.164, matches to existing lead or creates one, inserts call record, promotes lead to "booked" if outcome matches, sends Slack Block Kit notification.

### Cron Security

Both cron routes verify `Authorization: Bearer <CRON_SECRET>`. Set the same value in Vercel project settings and `vercel.json` defines the schedules.

### Design System

All UI uses custom Tailwind utilities defined in `src/app/globals.css`:
- `.glass-card` — main card surface (backdrop blur, border, shadow)
- `.glass-card-sm` — smaller/darker variant
- `.glass-input` — form inputs
- `.glass-btn-primary` / `.glass-btn-secondary` — buttons
- `.status-badge` — coloured pill badges; colours from `statusColor()` in `src/lib/utils.ts`

Background is a fixed purple gradient (`--bg-start: #0f0c29` → `#302b63` → `#24243e`).

### `src/app/api/email/send/route.ts` exports

This file exports `upsertEmailConversation()` as a named export — it is imported by `gmail-poll/route.ts` to append inbound messages to the same conversation JSONB array.

### Types

`src/types/database.ts` — single source of truth for all table row types and the `Database` generic used by the Supabase client. When adding a new table/column, update both the migration file and this types file.

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in all values. The `ENCRYPTION_KEY` must be exactly 64 hex chars (`openssl rand -hex 32`). Missing `ANTHROPIC_API_KEY` will crash the sequence cron at runtime.
