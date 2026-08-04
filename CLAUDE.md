# HostAI Concierge — project memory

Read this first. It is the handoff document for anyone (human or Claude Code)
picking the project up in an editor.

---

## 1. What this is

A B2B2C micro-SaaS for short-let hosts (Airbnb / Booking.com).

- The **host** signs in, fills in one property profile (wifi, rules,
  appliances, local recommendations, paid extras, emergency contacts) and
  downloads a QR code.
- The **guest** scans that QR code in the apartment. It opens a mobile web
  chat — **no app, no login, no account**. They ask questions in any language
  and can send photos.
- An AI concierge answers from the host's own notes, sells extras, spots
  unhappy guests, and alerts the host when something is actually wrong.

Money model: the host pastes their own Stripe Payment Links. Payments go
directly to the host's Stripe account — this product never touches the money,
it only attributes the sale.

**Live URLs when running:**

| Path | Who | What |
| --- | --- | --- |
| `/` | public | landing page |
| `/login` | host | email + password sign-in / sign-up |
| `/dashboard` | host | property list |
| `/dashboard/properties/[id]` | host | 8-tab property editor |
| `/dashboard/settings` | host | Stripe connection + revenue |
| `/chat/[propertyId]` | **guest, public** | the concierge |
| `/api/health` | ops | env-var readiness, 200 or 503 |

---

## 2. Status — what is done

All five planned phases are complete and pushed to
`claude/hostai-concierge-saas-yb251l`.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Next.js 14 + Tailwind + shadcn/ui, Supabase auth, full SQL schema with RLS | done |
| 2 | Host dashboard, property editor, QR generator | done |
| 3 | Mobile guest chat, photo upload, session persistence | done |
| 4 | Claude integration, master system prompt, sentiment, upsells, host alerts | done |
| 5 | Stripe revenue tracking, security headers, deployment checklist | done |

**Never run end-to-end against real services.** Everything was verified by
type-check, production build, a real Postgres 16 instance for the SQL, and
unit tests of the pure logic. There was no Supabase project and **no
`ANTHROPIC_API_KEY`** available in the build environment, so the live Claude
round-trip and the live Stripe webhook have **never actually executed**. That
is the single biggest known gap — see §6.

---

## 3. Stack and conventions

- **Next.js 14 App Router**, TypeScript, `src/` directory, `@/*` import alias.
- **Tailwind CSS 3** + **shadcn/ui** (new-york style, zinc base). Note: this is
  Tailwind **v3** with HSL CSS variables. If you `npx shadcn add` a new
  component and the theme breaks, it is because shadcn now emits Tailwind v4
  `oklch()` variables — keep `src/app/globals.css` on HSL triplets.
- **Supabase** for Postgres, Auth and Storage.
- **Anthropic SDK** (`@anthropic-ai/sdk`), model `claude-sonnet-5` by default.
- **Stripe SDK** used only to verify webhook signatures.
- **Zod** for input validation.

### Code conventions actually used here

- **Mutations are Server Actions**, not API routes. API routes exist only for
  the guest-facing surface (which is unauthenticated) and the Stripe webhook.
- **Every list row is its own `<form>`** with inline edit + a sibling delete
  form. No dialogs, no client-side stores. See
  `src/components/dashboard/appliance-editor.tsx` for the pattern to copy.
- Server actions return `ActionState` (`{ ok, message }`) and the client uses
  `useFormState`. `ActionState` lives in `src/lib/dashboard/action-state.ts`,
  deliberately **separate** from `guard.ts` — `guard.ts` is `server-only` and
  client components import the state type.
- Prices are **integer cents**, never floats.
- Database row types in `src/types/database.ts` must be `type` aliases, never
  `interface`. Interfaces have no implicit index signature, so PostgREST's
  query parser silently resolves every `.select()` to `never`.

---

## 4. Architecture — the parts that matter

### Two Supabase clients, by trust level

| Client | File | Key | Used by |
| --- | --- | --- | --- |
| Browser | `lib/supabase/client.ts` | anon + RLS | host UI |
| Server | `lib/supabase/server.ts` | anon + RLS | host server components / actions |
| **Admin** | `lib/supabase/admin.ts` | **service role, bypasses RLS** | guest API routes + Stripe webhook only |

Guests are anonymous, so they can never hold a Supabase session. They talk to
our own API routes, which use the admin client. **This is why RLS can be
strict owner-only on every table.**

### The guest request path

```
/chat/[propertyId]  (server component, narrow 5-column projection)
        ↓
GuestChat (client)  → POST /api/chat/upload   → Supabase Storage
                    → POST /api/chat          → the loop below
                    → GET  /api/chat/history  → replay after refresh
```

`POST /api/chat` does, in order: rate limit → validate property is active →
validate image URL is ours → find or create session → load last 20 turns →
insert the guest's message → **one Claude call** → attach payment link →
insert the reply → raise an alert if needed.

### The single Claude call

`src/lib/chat/reply.ts` sends one request that returns **structured JSON**:

```json
{ "reply", "language", "sentiment", "escalate", "escalation_reason", "upsell_id" }
```

One call instead of answer-then-classify halves both guest-visible latency and
cost. `src/lib/chat/prompt.ts` builds the system prompt from the property.

---

## 5. Invariants — do not break these

These are deliberate. If a change appears to require breaking one, that change
is wrong.

1. **The model never produces a payment URL.** It returns an `upsell_id`; the
   server attaches the host's real Stripe link. The Stripe URL is never even
   included in the prompt. Additionally any `stripe.com` URL in the model's
   prose is stripped in `src/app/api/chat/route.ts`.
2. **Guest image URLs are validated against our own storage prefix**
   (`isOwnUpload`). Without it, a guest could pass any URL and turn the vision
   call into a fetch proxy.
3. **`sentiment: "critical"` always alerts the host**, regardless of the
   model's `escalate` flag. Two independent signals.
4. **The guest page selects an explicit column list**, never `select("*")`.
   `wifi_password`, `host_phone` and `alert_webhook_url` must not reach the
   browser — they only ever appear inside the AI's prose.
5. **Alerts are written to the DB before the webhook is attempted**, so a
   failed delivery still leaves a trail in the Inbox tab.
6. **`stripe_event_id` is unique.** Stripe retries; the insert conflict
   (SQLSTATE `23505`) is treated as success.
7. **The guest's session id is a bearer token.** Whoever holds it can read that
   conversation. That is the accepted model — there is no account, because "no
   login" is the product.

---

## 6. What is NOT done — pick up here

Ordered by what would bite first in production.

### 6.1 Nothing has run against live services (highest priority)

Get a Supabase project and an `ANTHROPIC_API_KEY`, then walk the whole flow
manually. Specifically unverified:

- The Claude request shape is type-checked but has never been **accepted** by
  the API. Watch the first call. Suspects if it 400s: `output_config.effort`
  combined with `output_config.format`, and the `image` block with a
  `{type: "url"}` source.
- The Supabase Storage upload path and public URL format
  (`/storage/v1/object/public/guest-uploads/...`) — `isOwnUpload` depends on
  that exact prefix. If Supabase returns a different shape, **image messages
  will be rejected**. Verify early.
- The Stripe webhook has never received a real event. Use
  `stripe listen --forward-to localhost:3000/api/stripe/webhook/<token>`.

### 6.2 Rate limiting is in-memory and per-process

`src/lib/chat/rate-limit.ts` is a fixed window in module memory. On Vercel,
N warm instances means N× the limit, and a cold start resets it. It stops a
runaway browser tab; it is **not** a security control. Replace with Upstash
Redis or Vercel KV before real traffic. This is the main cost-exposure risk —
the guest chat endpoint is unauthenticated and calls a paid API.

### 6.3 No email alerts

`alert_email` is captured in the Emergency tab and stored, but nothing sends
to it. Only the webhook fires. Add Resend (free tier) in
`src/lib/chat/alerts.ts` next to `dispatchWebhook`.

### 6.4 Host cannot read guest conversations

`chat_messages` are stored and RLS already allows the owning host to read
them, but there is no UI. The Inbox tab lists sessions and alerts only. A
transcript view under `/dashboard/properties/[id]` would be a small, high-value
addition.

### 6.5 Other known gaps

- **No streaming.** The guest waits for the full reply. Streaming would feel
  much faster; it conflicts with structured outputs, so it needs a rethink
  (e.g. stream prose, classify in a cheap second call).
- **No tests.** Verification so far was ad-hoc scripts. Vitest + a few unit
  tests around `prompt.ts`, `validation.ts` and the payment-link stripper
  would be the cheapest durable win.
- **No i18n on the host dashboard** (guest side is fully multilingual already).
- **Storage cleanup:** guest photos are never deleted. Add a retention job.
- **`alert_webhook_url` is host-supplied and fetched server-side** — an SSRF
  vector by design. It is `redirect: "manual"` with a 5s timeout, but a
  determined host could point it at an internal address. Acceptable while
  hosts are trusted; block private IP ranges before opening signups.
- **Free-tier limits:** Supabase pauses a project after 7 days idle.

---

## 7. How to work on it

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

Before committing:

```bash
npx tsc --noEmit && npm run lint && npm run build
```

**Database changes:** edit `supabase/schema.sql` and re-run the whole file in
the Supabase SQL Editor. It is written to be idempotent and to upgrade an
existing install — use `create table if not exists`, `alter table ... add
column if not exists`, and `drop policy if exists` before `create policy`.
Then mirror the change in `src/types/database.ts` by hand.

The SQL was verified by applying it twice to a fresh Postgres 16, and by
applying it over a previous version to confirm existing rows survive and new
columns backfill.

---

## 8. Deployment

See `DEPLOYMENT.md` for the full checklist. Short version: push to GitHub,
import to Vercel, set the environment variables, then update
`NEXT_PUBLIC_SITE_URL` and the Supabase redirect URLs to the real domain.
`/api/health` returns 503 and names any missing variable.

**Regenerate QR codes if the domain changes** — they encode the absolute URL.
