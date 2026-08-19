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

**Total: 65 tests, 65 passing, 0 failing** — run and confirmed in this
environment via Node's built-in test runner (`node --experimental-strip-types
--test`). Reproduce with `npm test` once dependencies are installed, or with
the raw command in [Running the tests](#running-the-tests) with zero install.

> A real bug was caught by actually running these tests: the scrypt password
> hash initially exceeded OpenSSL's default 32 MB `maxmem` and threw
> `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`. Fixed by passing an explicit `maxmem`
> sized to the scrypt parameters (`lib/auth/password.ts`), then re-verified.

### 🟡 Scaffolded — written but NOT executed/verified

| Area | Files | Why not verified |
|---|---|---|
| Auth + card API routes | `app/api/auth/**`, `app/api/cards/**`, `app/api/users/me/cards/**` | **Now wired** to the tested cores, but the Prisma/cookie I/O runs only in the Next.js server runtime — not exercised by offline unit tests. The business rules they call ARE tested. |
| Receipt + dashboard API routes | `app/api/receipts/**`, `app/api/dashboard/**` | Still return `501 Not Implemented` with spec pointers (next build steps). |
| Prisma adapters | `lib/cards/prisma-repository.ts`, `lib/auth/prisma-user-repository.ts` | Real query-mapping code implementing the tested service ports; require a generated client + live DB (not runnable offline). |
| Request/session bridge | `lib/auth/current-user.ts` | Cookie + clock wrapper around the tested `session.ts`; needs the Next.js runtime. |
| Prisma schema | `prisma/schema.prisma` | Never applied to a DB — no Postgres/network here. Not run through `prisma generate`/`migrate`. |
| Seed script | `prisma/seed.ts` | Never executed — no DB. Reuses `lib/fixtures/cards.ts` as the single source of truth so seed data and tested fixtures can't drift. |
| Textract OCR provider | `lib/ocr/textract-provider.ts` | Real `AnalyzeExpense` call is **written but commented out** (no AWS network + SDK not installed). Throws if selected. |
| Frontend pages | `app/layout.tsx`, `app/page.tsx` | Placeholder shell only. |
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
node --experimental-strip-types --test \
  lib/rewards-engine.test.ts \
  lib/ocr/route-receipt.test.ts \
  lib/categorizer/categorizer.test.ts \
  lib/auth/password.test.ts \
  lib/auth/session.test.ts \
  lib/auth/authz.test.ts \
  lib/auth/user-service.test.ts \
  lib/validation.test.ts \
  lib/cards/service.test.ts
```

Or, after `npm install`:

```bash
npm test          # runs the same suite
npm run typecheck # full tsc once @types/node etc. are present
```

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

The engine (step 3) is done and tested. Remaining, in order:

1. Implement auth service + session cookies (`lib/auth.ts`, `app/api/auth/*`)
2. Wire card catalog + user-card CRUD (`app/api/cards/*`, `app/api/users/me/cards/*`)
3. Implement receipt upload → OCR → `needs_review` flow (`app/api/receipts`)
4. On receipt confirm, call `evaluatePurchase()` and persist a
   `reward_calculation` **with its rule snapshot**
5. Dashboard aggregation (confirmed receipts only)
6. Frontend flow: auth → card mgmt → upload/review → dashboard

Add auth/authorization and data-versioning tests (Section 6) as those layers
land — those require the DB and could not be written meaningfully against the
stubs here.
