import type { HealthResponse } from "../api/types"
import { ScaleIcon, SparkleIcon, UploadIcon } from "./icons"
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

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
      <span className="text-indigo-400">{icon}</span>
      {children}
    </h2>
  )
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
        <SectionTitle icon={<UploadIcon className="h-4 w-4" />}>Data</SectionTitle>
        <div className="mb-3 flex rounded-lg bg-black/30 p-1 text-sm ring-1 ring-inset ring-white/5">
          {(["sample", "upload"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSourceChange(s)}
              className={`flex-1 rounded-md px-2 py-1.5 transition-all ${
                source === s
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow shadow-indigo-900/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s === "sample" ? "Sample month" : "Upload CSVs"}
            </button>
          ))}
        </div>
        {source === "upload" && (
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Bank statement CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && onBankFile(e.target.files[0])}
                className="text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-slate-100 file:transition-colors hover:file:bg-white/20"
              />
              {bankFileName && <span className="text-xs text-emerald-400">✓ {bankFileName}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">General ledger CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && onLedgerFile(e.target.files[0])}
                className="text-xs text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-slate-100 file:transition-colors hover:file:bg-white/20"
              />
              {ledgerFileName && <span className="text-xs text-emerald-400">✓ {ledgerFileName}</span>}
            </label>
            <p className="rounded-lg bg-black/20 p-2 text-[11px] leading-snug text-slate-500">
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
            className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-slate-100 outline-none transition-colors focus:border-indigo-500"
          />
        </label>
      </Card>

      <Card>
        <SectionTitle icon={<ScaleIcon className="h-4 w-4" />}>Matching rules</SectionTitle>
        <label className="mb-4 flex flex-col gap-2 text-sm">
          <span className="flex justify-between text-slate-300">
            <span>Date window (days)</span>
            <span className="rounded bg-white/5 px-1.5 text-xs text-indigo-300">{windowDays}</span>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            value={windowDays}
            onChange={(e) => onWindowChange(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="flex justify-between text-slate-300">
            <span>"Near amount" tolerance (%)</span>
            <span className="rounded bg-white/5 px-1.5 text-xs text-indigo-300">{pct}</span>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={pct}
            onChange={(e) => onPctChange(Number(e.target.value))}
          />
        </label>
      </Card>

      <Card>
        <SectionTitle icon={<SparkleIcon className="h-4 w-4" />}>AI</SectionTitle>
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
