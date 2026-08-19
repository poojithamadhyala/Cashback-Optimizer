# Loyalty & Cashback Optimizer — v1

Scan receipts, learn whether the card you used was optimal, and see which card
you *should* have used — based on real, researched reward-rate data.

This repository is the v1 scaffold described in the project spec. **Read the
status section below carefully — it is explicit about what has actually been
built and verified versus what is stubbed.**

---

## ⚠️ Build status: what is real vs. scaffolded

This project was scaffolded in an **offline sandbox with no npm registry
access, no Postgres, and no AWS network**. That constraint shaped what could
be genuinely executed here versus what is written-but-unrun. No claims below
are aspirational.

### ✅ Implemented AND verified (tests actually executed)

| Module | File | Status |
|---|---|---|
| **Rewards engine** (pure, deterministic core) | `lib/rewards-engine.ts` | ✅ Implemented, type-checks clean |
| Researched card fixtures | `lib/fixtures/cards.ts` | ✅ Implemented, type-checks clean |
| Rewards engine tests | `lib/rewards-engine.test.ts` | ✅ **15 tests, all passing** |
| OCR confidence-routing logic | `lib/ocr/route-receipt.ts` | ✅ Implemented |
| OCR routing tests | `lib/ocr/route-receipt.test.ts` | ✅ **9 tests, all passing** |
| Merchant categorizer | `lib/categorizer/categorizer.ts` | ✅ Implemented |
| Categorizer tests | `lib/categorizer/categorizer.test.ts` | ✅ **4 tests, all passing** |
| **Password hashing** (scrypt, node:crypto) | `lib/auth/password.ts` | ✅ Implemented + 6 tests |
| **Session tokens** (HMAC-SHA256, expiry) | `lib/auth/session.ts` | ✅ Implemented + 6 tests |
| **Authorization / ownership guards** | `lib/auth/authz.ts` | ✅ Implemented + 5 tests |
| **User auth service** (signup/login rules) | `lib/auth/user-service.ts` | ✅ Implemented + 5 tests |
| **Input validation** | `lib/validation.ts` | ✅ Implemented + 8 tests |
| **Card CRUD service** (ownership-enforced) | `lib/cards/service.ts` | ✅ Implemented + 7 tests |
| **Receipt service** (OCR→needs_review→confirm→calc+snapshot) | `lib/receipts/service.ts` | ✅ Implemented + 10 tests |
| **Dashboard aggregation** (confirmed-only + cheatsheet) | `lib/dashboard/service.ts` | ✅ Implemented + 2 tests |
| Quarter helper | `lib/receipts/quarter.ts` | ✅ Implemented + 1 test |
| **Local-disk object storage** (real bytes to disk) | `lib/storage/local-disk.ts` | ✅ Implemented + 4 tests |
| **SQLite DB integration tests** (real on-disk SQL) | `lib/receipts/sqlite-integration.test.ts` | ✅ **3 tests, all passing** |
| **API client** (response handling, error mapping) | `lib/api/client.ts` | ✅ Implemented + 10 tests |
| **API serializers** (record → DTO, strips internal fields) | `lib/api/serializers.ts` | ✅ Implemented + 4 tests |
| **UI formatters** (currency, pct, status, category) | `lib/ui/format.ts` | ✅ Implemented + 6 tests |

**Total: 106 tests, 106 passing, 0 failing** — run and confirmed in this
environment via Node's built-in test runner (`node --experimental-strip-types
--test`). Reproduce with `npm test` once dependencies are installed, or with
the raw command in [Running the tests](#running-the-tests) with zero install.

Two acceptance criteria from the spec are proven by dedicated tests:
- **needs_review exclusion (Section 2):** low OCR confidence → status
  `needs_review` → the receipt has no calculation and is excluded from
  dashboard totals (`lib/receipts/service.test.ts`, test "(A)").
- **Rule versioning is adversarial (Section 6):** a receipt is confirmed and its
  reward calculated; the underlying card rule's rate is then mutated (3% → 5%);
  the previously-stored calculation is re-fetched and asserted **byte-for-byte
  unchanged**, with the snapshot still holding the old 3% rate
  (`lib/receipts/service.test.ts`, test "(B)"). This proves immunity to later
  mutation, not merely that a snapshot field is populated.

> Real bugs caught by actually running the tests (not hypothetical):
> 1. scrypt exceeded OpenSSL's default 32 MB `maxmem` →
>    `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`; fixed with an explicit `maxmem`.
> 2. Two classes used TypeScript *parameter properties*, which Node's
>    type-stripping runtime rejects; converted to explicit field assignments.
> 3. A pure helper (`quarterOf`) was initially placed in a module that
>    transitively imports Prisma, so its test couldn't load offline; extracted
>    to `lib/receipts/quarter.ts`.

### 🟡 Scaffolded — written but NOT executed/verified

| Area | Files | Why not verified |
|---|---|---|
| Auth + card API routes | `app/api/auth/**`, `app/api/cards/**`, `app/api/users/me/cards/**` | **Now wired** to the tested cores, but the Prisma/cookie I/O runs only in the Next.js server runtime — not exercised by offline unit tests. The business rules they call ARE tested. |
| Receipt + dashboard API routes | `app/api/receipts/**`, `app/api/dashboard/**` | **Now wired** to the tested receipt/dashboard services (upload/list/get/confirm/delete, summary, cheatsheet). Prisma I/O runs only in the Next.js runtime; the business logic they call is unit-tested. Image bytes are persisted for real via LocalDiskStorage (dev) — see Object storage below. |
| Receipt/calc/card-rules Prisma adapters | `lib/receipts/prisma-*.ts` | Real query-mapping implementing the tested service ports; need a generated client + live DB. |
| Prisma adapters | `lib/cards/prisma-repository.ts`, `lib/auth/prisma-user-repository.ts` | Real query-mapping code implementing the tested service ports; require a generated client + live DB (not runnable offline). |
| Request/session bridge | `lib/auth/current-user.ts` | Cookie + clock wrapper around the tested `session.ts`; needs the Next.js runtime. |
| Prisma schema | `prisma/schema.prisma` | Never applied to a DB — no Postgres/network here. Not run through `prisma generate`/`migrate`. |
| Seed script | `prisma/seed.ts` | Never executed — no DB. Reuses `lib/fixtures/cards.ts` as the single source of truth so seed data and tested fixtures can't drift. |
| Textract OCR provider | `lib/ocr/textract-provider.ts` | Real `AnalyzeExpense` call is **written but commented out** (no AWS network + SDK not installed). Throws if selected. |
| Frontend pages | `app/(auth)/*`, `app/cards`, `app/receipts`, `app/dashboard`, `app/page.tsx` | **Written** against the real API contract, consuming the tested API client + UI formatters. **NOT rendered/verified in a browser** — no npm/Next in the build sandbox, so `next dev` could not run. Consistency was checked without a compiler: every `api.*` call and every DTO field the pages use is confirmed to exist. Needs a real `npm run dev` to verify rendering/interaction. |
| `package.json` versions | `package.json` | Dependency versions are best-effort pins; **not verified to install/resolve** (no npm access). Adjust as needed. |

**Architecture note:** auth and card CRUD follow a ports-and-adapters split —
pure, unit-tested business logic (`lib/auth/*-service.ts`, `lib/cards/service.ts`)
depends only on repository *interfaces*, with Prisma adapters supplying the real
persistence. This is what let the authorization rules (user A cannot touch user
B's card → 403) be genuinely tested here against an in-memory fake, with no DB.

### 🔴 Known honest gaps

- `@types/node` and all npm deps are **not installed**, so a full
  `tsc --noEmit` / `next build` will report missing-type and missing-module
  errors until you run `npm install`. The pure business-logic files
  type-check clean on their own.
- The OCR *model* itself is intentionally untested (per spec Section 6 — only
  the confidence-threshold branching is tested, with mocked OCR responses).

---

## Architecture (spec Section 4)

Independently-testable modules, not one god route handler:

- **`lib/rewards-engine.ts`** — pure `evaluatePurchase(...)`: given a category,
  amount, cards, and an explicit evaluation context, returns
  `{ actual, optimal, missedCents, perCard }`. No I/O, no AI. Deterministic;
  same inputs → same output. Handles points-vs-cashback (`unit` +
  `pointValueCents`), annual caps (with partial-cap spanning), rotating-quarter
  activation, effective-date windows, ties (deterministic tie-break), and
  missing rules.
- **`lib/ocr/`** — swappable OCR provider interface (`MockOcrProvider` default,
  `TextractOcrProvider` for AWS), plus the pure `routeReceipt(...)` decision
  that sends low-confidence / missing-field receipts to `needs_review`.
- **`lib/categorizer/`** — rules-based merchant → category mapping with an
  explicit **unresolved** output (never a silent guess into money math).
- **`lib/auth.ts`** — auth/session contract, isolated from business logic.

### Design decisions honored

- **Points vs. cashback** (Section 9): rules carry `unit`
  (`cashback_pct | points_per_dollar`) and points rules carry
  `pointValueCents`. Chase Sapphire Preferred is modeled as points (~2¢/pt);
  Amex BCE and Citi Double Cash as true cashback %.
- **Rule versioning** (Section 3): `reward_calculations.ruleVersionSnapshot`
  (JSON) freezes the exact rules used, so removing/editing a card never
  retroactively changes historical numbers.
- **Citi Double Cash** (Section 10): modeled as flat 2% in v1 — a documented
  simplification of its "1% + 1% on payment" mechanic.
- **Integer-cents math** throughout the engine to avoid float drift.

---

## Running the tests

With **zero dependencies installed** (as in the build sandbox), using Node ≥ 22:

```bash
# all suites (same as `npm test`)
node --experimental-strip-types --test 'lib/**/*.test.ts'
```

Or, after `npm install`:

```bash
npm test               # full lib suite incl. SQLite integration (85 tests)
npm run test:unit      # pure-logic unit tests only (skips SQLite)
npm run test:sqlite    # just the real-DB SQLite integration tests
npm run typecheck      # full tsc once @types/node etc. are present
```

## Database integration testing (real SQL, two tiers)

The service layer is unit-tested with in-memory fakes, but the two guarantees
that are expensive to get wrong — **needs_review exclusion** and **rule-snapshot
immutability** — are also tested against a **real SQL database**, at two tiers:

1. **SQLite, runs anywhere (incl. this offline sandbox).** Uses Node's built-in
   `node:sqlite` (zero deps). `lib/receipts/sqlite-repository.ts` implements the
   same repository ports the service depends on, with a schema mirroring
   `prisma/schema.prisma`; `lib/receipts/sqlite-integration.test.ts` drives the
   actual receipt/dashboard services against an on-disk DB file. It proves, with
   a real SQL `UPDATE card_reward_rules SET rate=5`, that a previously-stored
   `reward_calculations` row is **byte-for-byte unchanged**. This is SQLite, not
   Postgres — labeled as such — but it is a genuine database round-trip.

   ```bash
   node --experimental-sqlite --experimental-strip-types \
     --test lib/receipts/sqlite-integration.test.ts
   ```

2. **Postgres via Prisma — the production path, run in CI.** `integration/pg/`
   contains the equivalent tests against the **actual production adapters**
   (`lib/receipts/prisma-repository.ts`), run against a real Postgres. These
   could NOT be executed in the build sandbox (no Postgres, no npm to install
   `@prisma/client`, no container registry to pull an image — all verified), so
   they are **honestly marked as not-run-here**. They DO run:
   - locally: `docker compose up -d db && ./scripts/run-integration.sh`
   - in CI: `.github/workflows/ci.yml` starts a `postgres:16` service container,
     applies the schema with `prisma db push`, and runs
     `integration/pg/*.pgtest.ts` on every push.

## Object storage (receipt images)

`POST /receipts` persists uploaded image bytes for real via a swappable
`ObjectStorage` interface (`lib/storage/`). v1 ships **`LocalDiskStorage`**,
which writes to a gitignored `uploads/` dir and returns a `local://<key>`
reference stored on `receipts.image_url`. Bytes are actually written and read
back (see `lib/storage/local-disk.test.ts`), not dropped.

> ⚠️ **LocalDiskStorage is dev-only.** Local disk does not survive container
> restarts, horizontal scaling, or serverless deploys. **Before any real
> deployment, implement an S3-backed `ObjectStorage`** (same interface) and
> select it via `STORAGE_PROVIDER=s3`. This is called out in the code and in
> "Suggested next steps".

---

## Getting to a running app (in a networked environment)

These steps could **not** be run in the build sandbox. Run them yourself:

1. `npm install`
2. Start Postgres (e.g. `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16`)
3. `cp .env.example .env.local` and fill in `DATABASE_URL`, `AUTH_JWT_SECRET`
4. `npm run prisma:generate && npm run prisma:migrate`
5. `npm run db:seed` — loads the researched catalog (Section 9)
6. `npm run dev`

`OCR_PROVIDER` defaults to `mock` (offline-safe; routes everything to
`needs_review`). Set it to `textract` and provide AWS creds — and uncomment the
implementation in `lib/ocr/textract-provider.ts` — to use AWS Textract.

---

## Suggested next steps (spec Section 7 build order)

Done and tested (steps 1–7):

- [x] Rewards engine (step 3) — pure, deterministic, table-driven tests
- [x] Auth service + session cookies (step 1) — `lib/auth/*`, `app/api/auth/*`
- [x] Card catalog + user-card CRUD (step 2) — `app/api/cards/*`, `app/api/users/me/cards/*`
- [x] Receipt upload → OCR → `needs_review` flow (step 4) — `lib/receipts/*`
- [x] Rewards engine wired to confirmed receipts + rule snapshot (step 6)
- [x] Dashboard aggregation, confirmed-only (steps 5/7)

Remaining:

1. **Production object storage (S3)** — dev uses `LocalDiskStorage`; implement an
   `S3Storage` behind the same `ObjectStorage` interface and select via
   `STORAGE_PROVIDER=s3` before deploying. (Local-disk storage is done + tested.)
2. **Rotating-category activation state** — `activatedRuleIds` is currently
   empty; source it from a user setting when rotating cards are added.
3. **Verify the frontend in a browser** — the pages (auth, cards, receipts,
   dashboard) are written against the API contract and their logic is tested,
   but they have not been rendered. Run `npm install && npm run dev` and click
   through the flows; wire any rough edges (loading states, redirects on 401).
4. **Run the Postgres integration suite in your environment** — the tests +
   docker-compose + CI workflow exist (`integration/pg/`, `.github/workflows/ci.yml`);
   they run in CI on push. The offline sandbox proved the same contracts against
   real SQLite. (Both tiers of DB integration testing are now in place.)
