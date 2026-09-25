import type { HealthResponse } from "../api/types"
import { Badge, Card } from "./ui"

interface SidebarProps {
  source: "sample" | "upload"
  onSourceChange: (s: "sample" | "upload") => void
  onBankFile: (file: File) => void
  onLedgerFile: (file: File) => void
  bankFileName?: string
  ledgerFileName?: string
  openingBalance: number
  onOpeningBalanceChange: (v: number) => void
  windowDays: number
  onWindowChange: (v: number) => void
  pct: number
  onPctChange: (v: number) => void
  health?: HealthResponse
}

export function Sidebar({
  source,
  onSourceChange,
  onBankFile,
  onLedgerFile,
  bankFileName,
  ledgerFileName,
  openingBalance,
  onOpeningBalanceChange,
  windowDays,
  onWindowChange,
  pct,
  onPctChange,
  health,
}: SidebarProps) {
  return (
    <aside className="flex w-full flex-col gap-5 lg:w-72 lg:shrink-0">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Data</h2>
        <div className="mb-3 flex rounded-lg bg-slate-800 p-1 text-sm">
          {(["sample", "upload"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSourceChange(s)}
              className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
                source === s ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s === "sample" ? "Sample month" : "Upload CSVs"}
            </button>
          ))}
        </div>
        {source === "upload" && (
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Bank statement CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && onBankFile(e.target.files[0])}
                className="text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-100"
              />
              {bankFileName && <span className="text-xs text-emerald-400">{bankFileName}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">General ledger CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && onLedgerFile(e.target.files[0])}
                className="text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-100"
              />
              {ledgerFileName && <span className="text-xs text-emerald-400">{ledgerFileName}</span>}
            </label>
            <p className="text-[11px] leading-snug text-slate-500">
              Bank: txn_id, date, description, reference, amount
              <br />
              Ledger: entry_id, date, description, reference, amount, account
            </p>
          </div>
        )}
      </Card>

      <Card>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Opening balance (INR)</span>
          <input
            type="number"
            value={openingBalance}
            step={10000}
            onChange={(e) => onOpeningBalanceChange(Number(e.target.value))}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
          />
        </label>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Matching rules</h2>
        <label className="mb-3 flex flex-col gap-1 text-sm">
          <span className="flex justify-between text-slate-300">
            <span>Date window (days)</span>
            <span className="text-slate-500">{windowDays}</span>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            value={windowDays}
            onChange={(e) => onWindowChange(Number(e.target.value))}
            className="accent-indigo-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex justify-between text-slate-300">
            <span>"Near amount" tolerance (%)</span>
            <span className="text-slate-500">{pct}</span>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={pct}
            onChange={(e) => onPctChange(Number(e.target.value))}
            className="accent-indigo-500"
          />
        </label>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">AI</h2>
        {!health ? (
          <span className="text-xs text-slate-500">Checking...</span>
        ) : health.ai_provider === "rules" ? (
          <Badge tone="warn">Offline mode (rules only)</Badge>
        ) : (
          <Badge tone="good">Using {health.ai_provider === "gemini" ? "Gemini" : "OpenAI"}</Badge>
        )}
      </Card>
    </aside>
  )
}
