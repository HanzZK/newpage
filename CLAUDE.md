# Mouravi (მოურავი) — project memory

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

**Market: Georgia.** Hosts pay the operator a flat subscription (~10 GEL /
month). Guest-facing upsells are optional for a host and are not where the
operator earns.

Money model for upsells: the host pastes their own payment link — from
whatever provider they use. Payments go directly to the host's account; this
product never touches the money, it only attributes the sale.

**Stripe does not operate in Georgia** (45 supported countries, Georgia is not
one). So the payment link is provider-agnostic: a Bank of Georgia, TBC,
unipay or Payze link is as valid as a Stripe one. The Stripe webhook is still
wired up and still works — it is just an optional path for the minority of
hosts with a foreign Stripe account. Everyone else records sales by hand (see
§4, manual purchases).

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
`claude/hostai-concierge-saas-yb251l` (branch name predates the rename to
**Mouravi / მოურავი**).

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Next.js 14 + Tailwind + shadcn/ui, Supabase auth, full SQL schema with RLS | done |
| 2 | Host dashboard, property editor, QR generator | done |
| 3 | Mobile guest chat, photo upload, session persistence | done |
| 4 | AI integration (originally Claude — see Phase 7), master system prompt, sentiment, upsells, host alerts | done |
| 5 | Stripe revenue tracking, security headers, deployment checklist | done |

### Phase 6 — Georgia (done)

The product was written for a market Stripe serves. It does not serve Georgia,
and the host dashboard was English-only. Changed:

| Change | Where |
| --- | --- |
| `upsells.stripe_payment_link` → `payment_link`, any provider | schema, types, validation, UI |
| Default currency `EUR` → `GEL`, prices format `ka-GE` | schema, `upsell-editor.tsx` |
| Manual sale recording (`upsell_purchases.source`) | schema, `settings/actions.ts` |
| Fabricated-payment-URL stripper widened past `stripe.com` | `api/chat/route.ts` |
| Host dashboard translated to Georgian | all of `components/dashboard`, `app/dashboard` |
| Profile backfill for users who signed up pre-schema | `schema.sql` |

The guest chat needed no translation — it already answers in whatever language
the guest writes, Georgian included.

### Phase 7 — Gemini instead of Claude (done)

The provider was switched at the owner's decision. The stated reason was
Georgian output quality, and on a five-case check (appliance instructions,
upsell trigger, escalation, grounding, Latin-script Georgian) the output was
good: no hallucination on a fact the host never supplied, correct escalation,
correct handling of `gamarjoba, check out romel saatzea?`.

That check also found two real bugs, both now fixed in `prompt.ts`:

1. `escalation_reason` came back in the *guest's* language. The host reading
   the alert is Georgian, so the prompt now pins that field to Georgian
   regardless of what the guest wrote.
2. On an indirect question the model named a paid extra and its price in the
   prose but left `upsell_id` empty — the guest reads about an offer with no
   way to buy it. Mentioning an extra and setting `upsell_id` are now stated
   as one action.

### Phase 8 — shared rate limiting + photo retention (done)

Both were §6 items. Both are now built and verified against the live project;
see §6.2 and §6.5. The one thing still outstanding is operational rather than
code: **nothing calls the cleanup endpoint on a schedule yet.**

### What has and has not run live

A Supabase project exists and the app runs against it. Verified against real
services: landing page, `/login`, signup, `/api/health` (200), the model
round-trip (text), **the full photo path** (upload → `isOwnUpload` → inline
bytes → a correct description of the image), **the shared rate limiter**
(including a 10-concurrent burst against a limit of 5), and **the cleanup
job** (auth rejection, scan, delete, re-run safety).

Only the Stripe webhook remains unexercised — low priority in this market.

**A profile row is required before a host can create anything.** The signup
trigger handles new users; the backfill in `schema.sql` handles anyone who
registered before the schema was first applied. This bit us once already — the
owner signed up, then ran the schema, and every property insert failed with
`violates foreign key constraint "properties_host_id_fkey"` until the backfill
ran.

---

## 3. Stack and conventions

- **Next.js 14 App Router**, TypeScript, `src/` directory, `@/*` import alias.
- **Tailwind CSS 3** + **shadcn/ui** (new-york style, zinc base). Note: this is
  Tailwind **v3** with HSL CSS variables. If you `npx shadcn add` a new
  component and the theme breaks, it is because shadcn now emits Tailwind v4
  `oklch()` variables — keep `src/app/globals.css` on HSL triplets.
- **Supabase** for Postgres, Auth and Storage.
- **Google Gen AI SDK** (`@google/genai`), model `gemini-3.6-flash`, via the
  **Interactions API** (`ai.interactions.create`) — not the older
  `generateContent`. One call per guest message, structured JSON out.
  `store: false` keeps guest conversations off Google's servers; we replay
  history from our own database.
  - **`thinking_level: "minimal"` is deliberate.** The default (`medium`)
    spent ~320 thinking tokens answering "what's the wifi password" — a 5×
    cost multiplier on a lookup, and latency a guest sits through. Verified
    against appliance instructions, escalation and grounding: no quality loss
    on this workload. Thinking cannot be disabled outright on this model.
  - **No prompt caching.** The property brief is re-billed every message.
    Gemini's context caching is explicit and has a minimum size; worth
    revisiting if per-message cost matters.
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
- Prices are **integer cents** (tetri), never floats.
- **The host dashboard is Georgian, hard-coded.** There is no i18n layer — UI
  strings and Zod messages are Georgian literals. If a second language is ever
  needed this becomes a real refactor; until then, keep new strings Georgian
  rather than mixing.
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
insert the guest's message → **one model call** → attach payment link →
insert the reply → raise an alert if needed.

### The single model call

`src/lib/chat/reply.ts` sends one request that returns **structured JSON**:

```json
{ "reply", "language", "sentiment", "escalate", "escalation_reason", "upsell_id" }
```

One call instead of answer-then-classify halves both guest-visible latency and
cost. `src/lib/chat/prompt.ts` builds the system prompt from the property.

Two shapes here are load-bearing and were established against the live API,
not from documentation — the published examples disagreed with reality:

- **Usage fields are `total_input_tokens` / `total_output_tokens` /
  `total_thought_tokens`**, not `prompt_tokens` / `completion_tokens`.
  `tokensOut` sums output *and* thought, or billing under-reports.
- **The schema uses no nullable type unions.** `escalation_reason` and
  `upsell_id` are required plain strings; empty string means null and
  `orNull()` converts at the boundary. Nullable unions are the least portable
  corner of every JSON-schema dialect and buy nothing here.

**Images are sent as inline base64, not as a URL.** Gemini will not fetch a
URL for you, so `fetchImagePart` pulls the bytes from our own storage. That
function is only ever reached for URLs `isOwnUpload` has already accepted —
keep the check in front of it or it becomes a fetch proxy (invariant 2).

---

## 5. Invariants — do not break these

These are deliberate. If a change appears to require breaking one, that change
is wrong.

1. **The model never produces a payment URL.** It returns an `upsell_id`; the
   server attaches the host's real link. The URL is never even included in the
   prompt. Additionally, any URL on a known payment host is stripped from the
   model's prose in `src/app/api/chat/route.ts` — see `PAYMENT_HOSTS`. Adding
   a provider means adding it to that list; a guest must never be shown a
   payment URL we did not mint.
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
   (SQLSTATE `23505`) is treated as success. It is nullable so hand-entered
   rows can coexist — Postgres allows many nulls in a unique index.
8. **A host can only insert and delete `source = 'manual'` purchases.** RLS
   enforces it. Stripe-sourced rows are written by the service role and are
   read-only to the host, so a bank-verified payment can never be forged or
   erased from the dashboard.
7. **The guest's session id is a bearer token.** Whoever holds it can read that
   conversation. That is the accepted model — there is no account, because "no
   login" is the product.

---

## 6. What is NOT done — pick up here

Ordered by what would bite first in production.

### 6.1 Rate limiting is the top remaining risk — see §6.2

The photo path is **verified end to end** (2026-08-04). A generated PNG of four
coloured quadrants went through the real `POST /api/chat/upload`, `isOwnUpload`
accepted the returned URL, and the model described the image correctly —
"ზედა მარცხენა კუთხეში წითელი, ზედა მარჯვენაში მწვანე…". Upload, URL check and
byte forwarding all work.

Two things about that path are worth knowing before you change it:

- `isOwnUpload` matches the literal prefix
  `<SUPABASE_URL>/storage/v1/object/public/guest-uploads/`. The upload route
  builds it; change either side and photos are dropped.
- **Both failure modes are silent by design.** A rejected URL and a failed
  `fetchImagePart` both end with the guest getting a text-only answer and no
  error. If photos seem ignored, log inside that catch before suspecting the
  model.

Still unverified: the Stripe webhook has never received a real event
(`stripe listen --forward-to localhost:3000/api/stripe/webhook/<token>`). Low
priority — most hosts in this market will never use it.

### 6.2 Rate limiting — done, with one caveat

`src/lib/chat/rate-limit.ts` is now two layers: the original in-memory window,
plus `public.consume_rate_limit` in Postgres that every instance shares. No
Upstash or Vercel KV account needed — Supabase was already there.

The atomicity is the whole point: the SQL function is a single
`insert … on conflict do update … returning`, so two concurrent requests
cannot both read `count = N` and both write `N + 1`. A read-then-write version
would let a burst through, which is exactly what this defends against.

**Caveat: it fails open.** If the database call errors, the limiter falls back
to the per-instance layer and logs `[rate-limit] shared counter unavailable`.
That is deliberate — a Supabase blip should degrade the brake, not take the
concierge offline for a guest standing in an apartment at 3am — but it means a
sustained outage weakens the limit. Acceptable, since the chat cannot answer
anything during such an outage anyway. That log line is also how you tell the
SQL was never applied: it fires on every request until the function exists.

Verified live (2026-08-04): counts and blocks correctly, the window resets,
**10 concurrent calls against a limit of 5 allow exactly 5** (the atomicity
that motivates the whole design), the function is not callable with the
browser key (401), and `rate_limits` is not readable with it either — RLS
returns no rows, and the `revoke` turns the request itself into a 401 rather
than a 200 that confirms the table exists.

### 6.2b Hosting: Vercel Hobby forbids commercial use

The moment a host is charged, the Hobby plan's terms are breached. Options:
Vercel Pro ($20/mo), Cloudflare Workers (free tier permits commercial use,
needs `@opennextjs/cloudflare`), or a small VPS. Decide before the first
paying host, not after.

### 6.2c Subscription billing does not exist

The business model is a flat monthly fee per host, and there is no code for
it — no plan enforcement, no invoicing, no dunning. `profiles.plan` exists
(`free` / `pro`) and nothing reads it. Collect via a Georgian provider on the
operator's own merchant account; that is a normal merchant relationship and
needs no licence. **Do not** route guest upsell money through the operator's
account — that makes the operator a payment intermediary and pulls in
National Bank of Georgia licensing.

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
- **Storage cleanup exists but nothing calls it.** `GET
  /api/cron/cleanup-uploads` deletes guest photos older than
  `UPLOAD_RETENTION_DAYS` (default 30) and is guarded by `CRON_SECRET` —
  wrong or missing secret returns **404**, not 401, so an unauthenticated
  caller does not learn the endpoint exists. **It still needs a scheduler
  pointed at it** (Vercel Cron, a Cloudflare trigger, or cron on a VPS).
  Until something calls it, photos accumulate exactly as before.
  Verified live: auth rejection, scanning, deletion, and re-run safety.
  Note `deleted` counts what the Storage API confirms removed, not what was
  requested — removing an already-gone object succeeds silently and listing
  lags deletion by a moment, so counting the request produces phantom
  deletions on a re-run.
- **No bank integration.** Bank of Georgia's Payment Manager and TBC both
  offer API-minted payment links with a completion callback, which would make
  upsell revenue automatic instead of hand-entered. It is API-driven, not
  paste-a-static-link, so it needs per-host merchant credentials — a real
  onboarding and custody burden. Ship it as an opt-in upgrade, never as a
  requirement.
- **Node 20 is deprecated by `@supabase/supabase-js`** (wants 22+). It builds
  and runs, but every command prints a warning. Upgrade Node.
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
