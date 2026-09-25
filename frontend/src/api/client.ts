import type {
  Explanation,
  HealthResponse,
  ReconContext,
  ReconcileResponse,
} from "./types"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {
      // response wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export function health(): Promise<HealthResponse> {
  return fetch(`${BASE_URL}/health`).then((res) => unwrap<HealthResponse>(res))
}

export function reconcileSample(
  window: number,
  pct: number,
  openingBalance: number,
): Promise<ReconcileResponse> {
  const qs = new URLSearchParams({
    window: String(window),
    pct: String(pct),
    opening_balance: String(openingBalance),
  })
  return fetch(`${BASE_URL}/reconcile/sample?${qs}`, { method: "POST" }).then((res) =>
    unwrap<ReconcileResponse>(res),
  )
}

export function reconcileUpload(
  bankFile: File,
  ledgerFile: File,
  window: number,
  pct: number,
  openingBalance: number,
): Promise<ReconcileResponse> {
  const qs = new URLSearchParams({
    window: String(window),
    pct: String(pct),
    opening_balance: String(openingBalance),
  })
  const form = new FormData()
  form.append("bank_file", bankFile)
  form.append("ledger_file", ledgerFile)
  return fetch(`${BASE_URL}/reconcile?${qs}`, { method: "POST", body: form }).then((res) =>
    unwrap<ReconcileResponse>(res),
  )
}

export function explain(
  exceptionId: string,
  ctx: ReconContext | null,
): Promise<Explanation> {
  return fetch(`${BASE_URL}/explain/${exceptionId}`, {
    method: "POST",
    headers: ctx ? { "Content-Type": "application/json" } : undefined,
    body: ctx ? JSON.stringify(ctx) : undefined,
  }).then((res) => unwrap<Explanation>(res))
}

export function ask(
  question: string,
  ctx: ReconContext | null,
  openingBalance: number,
): Promise<{ answer: string }> {
  return fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context: ctx, opening_balance: openingBalance }),
  }).then((res) => unwrap<{ answer: string }>(res))
}
