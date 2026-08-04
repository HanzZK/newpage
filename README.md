# HostAI Concierge

A 24/7 multilingual AI concierge for short-let hosts. The host fills in one
property profile and gets a QR code; the guest scans it and talks to an AI that
knows the wifi password, how the washing machine works, when the bins go out,
and which upsells are for sale.

**Status: all five phases complete.** New here? Read
[`CLAUDE.md`](CLAUDE.md) — it is the project memory: what this is, what is
done, what is not, and the invariants not to break.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation, auth, database schema | ✅ done |
| 2 | Host dashboard, property editor, QR generator | ✅ done |
| 3 | Guest chat UI (`/chat/[propertyId]`) + image upload | ✅ done |
| 4 | Claude API route, master system prompt, sentiment + upsell logic | ✅ done |
| 5 | Stripe, webhooks, Vercel deploy | ✅ done |

To run Phase 4 you need `ANTHROPIC_API_KEY` in `.env.local`. Without it the
guest chat returns an error on send; everything else still works.

---

## Stack

- **Next.js 14** (App Router, `src/` dir, TypeScript)
- **Tailwind CSS 3** + **shadcn/ui** (new-york, zinc)
- **Supabase** — Postgres, Auth, Storage
- **Anthropic Claude** — chat + vision (Phase 4)
- **Stripe** — payment links for upsells (Phase 5)
- **qrcode.react** — QR generation (Phase 2)

---

## Setup

### 1. Install

```bash
git clone https://github.com/hanzzk/newpage.git
cd newpage
npm install
```

### 2. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   (the free tier is enough).
2. Open **SQL Editor** → **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. It is idempotent —
   safe to re-run after edits.
3. Go to **Authentication → Providers → Email** and, for local development,
   turn **Confirm email** off. That lets you sign up and land straight in the
   dashboard without an inbox round-trip. Turn it back on before launch.
4. Go to **Authentication → URL Configuration** and add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-app.vercel.app/auth/callback`

### 3. Environment variables

```bash
cp .env.example .env.local
```

Then fill it in:

| Variable | Where to get it | Needed by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → `anon` `public` key | Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role` key | Phase 3+ |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally | Phase 1 |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Phase 4 |
| `ANTHROPIC_MODEL` | defaults to `claude-sonnet-5` | Phase 4 |

Stripe needs no app-level keys: Payment Links live in the host's own Stripe
account, and each host pastes their own webhook signing secret into
`/dashboard/settings`.

> `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It must never be
> prefixed with `NEXT_PUBLIC_` and never imported into a `"use client"` file.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>, click **Get started**, create an account, and you
should land on `/dashboard`.

---

## Security model

Two different Supabase clients, on purpose:

- **Anon key + RLS** (`src/lib/supabase/client.ts`, `server.ts`) — everything
  the logged-in host does. RLS policies restrict every table to rows the host
  owns, so a leaked anon key exposes nothing.
- **Service role** (`src/lib/supabase/admin.ts`) — server-only. The guest chat
  is anonymous by design (no login, no app), so guests never talk to Postgres
  directly. They hit our own API routes, which read the property with the
  service-role client and return only what the AI needs. That keeps
  `wifi_password`, `host_phone` and `alert_webhook_url` off the public client.

`src/middleware.ts` refreshes the auth cookie on every request and gates
`/dashboard/*`. `/chat/*` stays public.

---

## Project layout

```
src/
  app/
    page.tsx                 landing page
    login/                   host sign-in / sign-up
    dashboard/               protected host area (Phase 2 builds this out)
    auth/callback/route.ts   email-confirmation code exchange
    auth/signout/route.ts    POST -> sign out
  components/
    auth/login-form.tsx
    ui/                      shadcn/ui primitives
  lib/
    chat/
      prompt.ts              the master system prompt
      reply.ts               the single Claude call (answer + sentiment + upsell)
      alerts.ts              alert rows and host webhook delivery
      context.ts             loads the full property brief, server-side only
      rate-limit.ts          per-process brake on the public endpoints
    env.ts                   typed env accessors with clear failure messages
    supabase/{client,server,admin,middleware}.ts
  types/database.ts          mirror of supabase/schema.sql
supabase/schema.sql          run this in the Supabase SQL Editor
legacy/                      the previous static site, kept for reference
```

---

## Notes

- `src/types/database.ts` is hand-written to match `supabase/schema.sql`. Once
  your project is live you can regenerate it instead:
  `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`.
  Keep the row types as `type` aliases, not `interface` — PostgREST's query
  parser needs an implicit index signature, and interfaces don't have one.
- The `legacy/` folder holds the static HTML site that was previously at the
  repo root. It was moved so Next.js wouldn't treat `pages/` as a Pages Router
  directory; nothing was deleted.

## How the concierge works

One Claude call per guest message returns structured JSON — the reply, the
detected language, a sentiment grade, an escalation flag and, when one fits,
the id of a paid extra. Doing it in one call instead of answer-then-classify
halves both the latency a guest waits and the bill.

Three deliberate constraints:

- **The model never writes a payment URL.** It selects an offer *id*; the
  server attaches the host's real Stripe link. A hallucinated payment link is
  the worst bug this product could ship, so the model is never in a position
  to produce one — and any Stripe URL it writes anyway is stripped.
- **A `critical` sentiment always alerts the host**, whatever the model set
  for the escalation flag. Two independent signals, either one is enough.
- **Guest messages are untrusted input.** The prompt states this explicitly,
  and the property brief is the only source the model may answer from.

Alerts are written to the database first and delivered to the host's webhook
second, so a failed delivery still leaves a trail in the property's Inbox tab.

## Revenue

Payment Links belong to the host's own Stripe account — this app never touches
the money. When the concierge sends a link it appends
`client_reference_id=<upsellId>_<sessionId>`, which Stripe passes back on
`checkout.session.completed`, so a sale is attributed to the exact offer and
the exact conversation that produced it.

## Deploying

See [`DEPLOYMENT.md`](DEPLOYMENT.md). `GET /api/health` returns 503 and names
any missing environment variable.
