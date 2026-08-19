/**
 * Shared API response DTOs — the single source of truth for what the API routes
 * return (verified against app/api/**) and what the frontend client + pages
 * consume. Keeping these here means the client and the pages can't drift from
 * the actual route JSON shapes.
 */

// --- Auth (POST /auth/signup, /auth/login) ----------------------------------
export interface AuthUserDTO {
  id: string;
  email: string;
}

// --- Cards ------------------------------------------------------------------
export interface CatalogCardDTO {
  id: string;
  issuer: string;
  productName: string;
  network: string;
}

export interface UserCardDTO {
  id: string;
  userId: string;
  cardCatalogId: string;
  nickname: string | null;
  addedAt: string; // ISO
}

// GET /cards/catalog
export interface CatalogResponse {
  cards: CatalogCardDTO[];
}
// GET /users/me/cards
export interface UserCardsResponse {
  cards: UserCardDTO[];
}
// POST /users/me/cards
export interface AddUserCardResponse {
  card: UserCardDTO;
}

// --- Receipts ---------------------------------------------------------------
export type ReceiptStatus = "needs_review" | "confirmed";

export interface ReceiptDTO {
  id: string;
  userId: string;
  merchantRaw: string | null;
  merchantNormalized: string | null;
  category: string | null;
  date: string | null;
  totalAmount: number | null;
  ocrConfidence: number | null;
  status: ReceiptStatus;
  userCardId: string | null;
  imageUrl: string | null;
  ocrRawText: string | null;
  createdAt: string; // ISO
}

// POST /receipts, GET /receipts/:id
export interface ReceiptResponse {
  receipt: ReceiptDTO;
}
// GET /receipts
export interface ReceiptsResponse {
  receipts: ReceiptDTO[];
}

export interface RewardCalculationDTO {
  id: string;
  receiptId: string;
  actualRate: number;
  actualCashback: number;
  optimalUserCardId: string | null;
  optimalRate: number;
  optimalCashback: number;
  missedAmount: number;
  calculatedAt: string;
}

// PATCH /receipts/:id (confirm) returns { receipt, calculation }
export interface ConfirmReceiptResponse {
  receipt: ReceiptDTO;
  calculation: RewardCalculationDTO;
}

// --- Dashboard --------------------------------------------------------------
export interface CategoryBreakdownDTO {
  category: string;
  missedAmount: number;
  actualCashback: number;
  optimalCashback: number;
  count: number;
}

export interface DashboardSummaryDTO {
  totalMissed: number;
  totalActualCashback: number;
  totalOptimalCashback: number;
  receiptCount: number;
  byCategory: CategoryBreakdownDTO[];
}

// GET /dashboard/summary
export interface DashboardSummaryResponse {
  summary: DashboardSummaryDTO;
}

export interface CheatsheetRowDTO {
  category: string;
  bestCardId: string | null;
  bestCardLabel: string | null;
  effectiveRatePct: number;
}
// GET /dashboard/best-card-cheatsheet
export interface CheatsheetResponse {
  cheatsheet: CheatsheetRowDTO[];
}

// --- Errors (shape produced by lib/http.ts errorResponse) -------------------
export interface ApiErrorBody {
  error: string; // AppErrorKind or "internal_error"
  message?: string;
  details?: Record<string, string>;
}
