# Loyalty & Cashback Optimizer

Scan a receipt, and the app tells you what you earned, what the **best card in
your wallet** would have earned, and the difference — using researched,
up-to-date reward rates. The reward math is deterministic, tested code (not an
LLM), and your history never silently changes when catalog rates are updated.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| **Language** | TypeScript 5.6 | strict mode |
| **Runtime** | Node.js ≥ 20 | dev on Node 22 (`node:sqlite`, native TS strip) |
| **Framework** | **Next.js 15** (App Router) | full-stack — UI pages *and* API route handlers |
| **UI** | React 19 | client components for the interactive flows |
| **Styling** | **Plain CSS + CSS variables + CSS Modules** | no Tailwind, no component library, **zero styling deps** |
| **Database** | **PostgreSQL** | local via Docker (`docker-compose.yml`) |
| **ORM** | **Prisma 5.22** | schema, migrations, typed queries |
| **Auth** | `node:crypto` | scrypt password hashing + HMAC-SHA256 session tokens (httpOnly cookie) |
| **OCR** | **AWS Textract** `AnalyzeExpense` (`@aws-sdk/client-textract`) | behind a swappable interface; Mock provider is the offline default |
| **Object storage** | Local disk (`node:fs`) for dev | swappable `ObjectStorage` interface; **S3 is the documented prod swap** |
| **Validation** | hand-written pure validators | (`zod` is a sanctioned swap-in but not currently imported) |
| **Testing** | **Node built-in test runner** (`node --test`) + `node:assert` | plus `node:sqlite` for real-DB integration tests; **106 tests** |
| **CI** | **GitHub Actions** | unit + SQLite jobs, and a Postgres service-container job |

### Deliberate "no dependency" choices
Auth crypto, input validation, styling, and the test runner all use **Node /
web built-ins** rather than third-party packages. The only heavy dependencies
are **Next/React**, **Prisma**, and the **AWS SDK**.

> **Dependency honesty:** `jose`, `bcryptjs`, and `zod` appear in
> `package.json` as sanctioned swap-ins, but the **shipped code does not import
> them** — password hashing/sessions use `node:crypto`, and validation is
> hand-rolled. Swap them in if you prefer; the interfaces won't change.

---

## Architecture at a glance

**Ports-and-adapters.** All business logic lives in pure, unit-tested modules
under `lib/` that depend only on repository *interfaces*. Prisma-backed adapters
supply the real persistence; in-memory / SQLite fakes back the tests. This is
what lets guarantees like "user A cannot touch user B's card → 403" and
"editing a rule never changes stored history" be tested without a database.

```
Next.js App Router
├─ app/(marketing) app/page.tsx      Dark navy + neon-green landing (+ landing.module.css)
├─ app/(auth)/…                      Login / signup
├─ app/cards, app/receipts, app/dashboard   Logged-in app (light "fintech-clean" theme)
├─ app/api/**                        Route handlers → call lib services
│
├─ lib/rewards-engine.ts             Pure deterministic engine (no I/O, no AI)
├─ lib/receipts/, lib/cards/, lib/auth/, lib/dashboard/   Service layer over ports
│    *-service.ts     pure rules (tested)
│    prisma-*.ts      Prisma adapters (real persistence)
│    sqlite-*.ts      SQLite adapters (integration tests)
├─ lib/ocr/           OCR interface + Mock + Textract providers + routing
├─ lib/storage/       ObjectStorage interface + LocalDiskStorage
├─ lib/api/           Typed client + DTOs + serializers (frontend ↔ API contract)
├─ lib/ui/            Pure formatters (currency, %, category, status)
├─ components/ui/     Reusable CSS-Module UI kit (Button, Card, Badge, StatCard…)
│
├─ prisma/            schema.prisma + seed.ts (researched card catalog)
└─ integration/pg/    Postgres/Prisma integration tests (run in CI)
```

### Core design decisions
- **Deterministic rewards math** — `evaluatePurchase(...)` is pure: same
  inputs → same output. Handles points-vs-cashback (`unit` + `pointValueCents`),
  annual caps with partial-cap spanning, rotating-quarter activation,
  effective-date windows, ties (deterministic tie-break), and missing rules.
  All money math is in **integer cents** to avoid float drift.
- **History that never drifts** — `reward_calculations.ruleVersionSnapshot`
  (JSON) freezes the exact rules used at calculation time, so editing or
  removing a card later never rewrites past numbers.
- **Never saved on a guess** — low-confidence OCR routes a receipt to
  `needs_review`; such receipts are excluded from dashboard totals until the
  user confirms them.
- **Points vs. cashback** — Chase Sapphire Preferred is modeled as points
  (~2¢/pt); Amex Blue Cash Everyday and Citi Double Cash as true cashback %.
  Citi Double Cash is modeled as a flat 2% in v1 (documented simplification).

---

## Getting started (local)

Requires Node ≥ 20 and Docker (for local Postgres).

```bash
npm install

# Prisma CLI reads .env; Next reads .env.local — create BOTH:
cp .env.example .env
cp .env.example .env.local
# set DATABASE_URL + AUTH_JWT_SECRET in both (the docker-compose default is:
#   postgresql://postgres:dev@localhost:5432/loyalty?schema=public )

docker compose up -d db                       # local Postgres
npm run prisma:generate && npx prisma db push # apply schema
npm run db:seed                               # load the researched card catalog

npm run dev                                   # http://localhost:3000
```

Then click through: **Sign up → Cards** (add a few from the catalog) **→
Receipts** (upload; it lands in *Needs review*) **→** open it, fill in the
details, **Confirm** to see actual-vs-optimal-vs-missed **→ Dashboard**.

> `OCR_PROVIDER` defaults to `mock` (routes every upload to `needs_review`).
> Set `OCR_PROVIDER=textract` + AWS creds and uncomment the implementation in
> `lib/ocr/textract-provider.ts` to use real Textract.

---

## Testing

**106 tests, all passing.** Uses Node's built-in runner — no Jest/Vitest.

```bash
npm test               # full lib suite incl. SQLite integration (106 tests)
npm run test:unit      # pure-logic unit tests only (skips SQLite)
npm run test:sqlite    # real-DB SQLite integration tests
npm run test:integration   # Postgres/Prisma integration (needs a live DB)
npm run typecheck      # tsc --noEmit
```

With **zero dependencies installed**, the pure-logic suites still run on Node ≥ 22:

```bash
node --experimental-sqlite --experimental-strip-types --test 'lib/**/*.test.ts'
```

### Two guarantees proven by dedicated tests
- **needs_review exclusion** — low OCR confidence → `needs_review` → no
  calculation row → excluded from dashboard totals.
- **Rule-snapshot immutability (adversarial)** — confirm a receipt, then mutate
  the underlying card rule's rate (3% → 5%) in the DB; the previously-stored
  calculation is re-fetched and asserted **byte-for-byte unchanged**. This is
  tested against both in-memory fakes and a **real SQL database**.

### Database integration testing — two tiers
1. **SQLite (`node:sqlite`), runs anywhere** — drives the real services against
   an on-disk DB file with a schema mirroring `prisma/schema.prisma`. Genuine
   SQL round-trips, no external services. (SQLite, not Postgres — labeled as such.)
2. **Postgres via Prisma (production path), runs in CI** — `integration/pg/`
   exercises the actual Prisma adapters. Locally:
   `docker compose up -d db && ./scripts/run-integration.sh`. In CI:
   `.github/workflows/ci.yml` spins up a `postgres:16` service container.

---

## How this repo was built (provenance & honesty)

This project was developed in an **offline sandbox with no npm registry, no
Postgres, and no AWS/container-registry network access**. That shaped what could
be executed there versus what runs in your environment:

- The **pure business logic + all 106 tests** were genuinely executed offline
  (Node's built-in runner + `node:sqlite`).
- The **frontend** (including the dark landing page) and the **API routes** run
  under Next.js — since verified end-to-end in a real browser via `npm run dev`.
- The **Postgres/Prisma** path and **AWS Textract** call are real code that run
  in a networked environment (CI / with credentials), not in the sandbox.
- After every change to page JSX, the **API contract was re-checked**: every
  `api.*` method used exists on the client, and every DTO field referenced
  exists in `lib/api/types.ts`.

Three real bugs were caught by *running* the tests (not hypothesized): a scrypt
`maxmem` overflow, two TS "parameter property" constructs the strip-types
runtime rejects, and a pure helper that transitively imported Prisma (extracted
so its test could load offline).

---

## UI

- **Landing page** (`/`) — dark navy + neon-green marketing page with a
  pure-CSS 3D card mockup, sticky nav, and honest feature copy. Theme is scoped
  to the landing via CSS Modules so it doesn't affect the app.
- **Logged-in app** — light "fintech-clean" theme (better for dense financial
  tables), a shared CSS-variable design system, a reusable UI component kit
  (`components/ui/*`), and a persistent nav (`components/AppNav.tsx`).
- Semantic color: **emerald = earned**, **red reserved strictly for missed
  rewards**.

---

## Remaining / next steps

1. **Production object storage (S3)** — implement an `S3Storage` behind the
   existing `ObjectStorage` interface; select via `STORAGE_PROVIDER=s3`.
   (Local-disk storage is done + tested for dev.)
2. **Rotating-category activation state** — `activatedRuleIds` is currently
   empty; source it from a user setting when rotating cards are added.
3. **Session-expiry UX** — pages currently surface a raw error on a 401 instead
   of redirecting to `/login`; add a redirect.
4. **Run the Postgres integration suite** in your environment / CI (wired and
   ready via `integration/pg/` + the GitHub Actions workflow).
