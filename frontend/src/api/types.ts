// Mirrors the JSON shapes produced by api.py / recon/report.py / recon/engine.py / recon/ai.py.
// Field names match the Python dict/dataframe columns exactly.

export type ExceptionType =
  | "amount_mismatch"
  | "bank_charges"
  | "interest_income"
  | "dishonoured_cheque"
  | "duplicate_entry"
  | "outstanding_cheque"
  | "deposit_in_transit"
  | "unexplained_bank"
  | "unexplained_ledger"

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  amount_mismatch: "Amount mismatch",
  bank_charges: "Bank charges",
  interest_income: "Interest credited",
  dishonoured_cheque: "Dishonoured cheque",
  duplicate_entry: "Duplicate entry",
  outstanding_cheque: "Outstanding cheque",
  deposit_in_transit: "Deposit in transit",
  unexplained_bank: "Unexplained (bank)",
  unexplained_ledger: "Unexplained (books)",
}

export interface Summary {
  bank_transactions: number
  ledger_entries: number
  auto_matched_pairs: number
  matched_with_difference: number
  exceptions: number
  match_rate_pct: number
  by_pass: Record<string, number>
  exceptions_by_type: Record<string, number>
}

export interface BrsReport {
  bank_lines: [string, number][]
  adjusted_bank: number
  book_lines: [string, number][]
  adjusted_book: number
  difference: number
  unexplained_ids: string[]
  unexplained_total: number
}

export interface ExceptionRow {
  exception_id: string
  type: ExceptionType
  side: "both" | "bank" | "ledger"
  txn_id: string | null
  entry_id: string | null
  amount: number
  difference: number | null
  fixes: "books" | "bank_side" | "investigate"
  account: string | null
  detail: string
}

export interface JournalEntryRow {
  exception_id: string
  debit_account: string
  credit_account: string
  amount: number
  narration: string
  status: string
}

// api.py serialises the matches dataframe with .astype(str), so every field is a string.
export interface MatchRow {
  txn_id: string
  entry_id: string
  match_pass: "exact" | "window" | "near"
  bank_date: string
  ledger_date: string
  date_gap_days: string
  desc_similarity: string
  bank_amount: string
  ledger_amount: string
  difference: string
  bank_description: string
  ledger_description: string
}

export interface ReconcileResponse {
  summary: Summary
  bank_reconciliation_statement: BrsReport
  exceptions: ExceptionRow[]
  proposed_journal_entries: JournalEntryRow[]
  matches: MatchRow[]
}

export interface JournalEntry {
  debit_account: string
  credit_account: string
  amount: number
  narration: string
}

export interface Explanation {
  explanation: string
  likely_cause: string
  recommended_action: string
  journal_entry: JournalEntry | null
  confidence: "high" | "medium" | "low"
  source: string
  validation: string
}

export interface HealthResponse {
  status: string
  ai_provider: "gemini" | "openai" | "rules"
}

export interface ReconContext {
  bank_csv?: string
  ledger_csv?: string
  window: number
  pct: number
}

export interface DatasetInput {
  source: "sample" | "upload"
  bankCsv?: string
  ledgerCsv?: string
  window: number
  pct: number
  openingBalance: number
}
