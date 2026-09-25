import type { ReactNode } from "react"
import type { Summary } from "../api/types"
import { formatInr } from "../format"
import { AlertIcon, BankIcon, LedgerIcon, MatchIcon, ScaleIcon } from "./icons"
import { Badge, Card } from "./ui"

function Metric({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string
  value: string
  sub?: ReactNode
  icon: ReactNode
  tint: string
}) {
  return (
    <Card className="relative flex flex-col gap-1 overflow-hidden">
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${tint}`}
      />
      <div className="relative flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="relative text-3xl font-bold tracking-tight text-slate-50">{value}</span>
      {sub}
    </Card>
  )
}

export function MetricsBar({ summary, difference }: { summary: Summary; difference: number }) {
  const reconciled = Math.abs(difference) < 0.01
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Metric
        label="Bank lines"
        value={String(summary.bank_transactions)}
        icon={<BankIcon className="h-4 w-4" />}
        tint="bg-indigo-500/20"
      />
      <Metric
        label="Ledger entries"
        value={String(summary.ledger_entries)}
        icon={<LedgerIcon className="h-4 w-4" />}
        tint="bg-violet-500/20"
      />
      <Metric
        label="Auto-matched"
        value={String(summary.auto_matched_pairs)}
        icon={<MatchIcon className="h-4 w-4" />}
        tint="bg-emerald-500/20"
        sub={
          <div className="relative mt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                style={{ width: `${Math.min(summary.match_rate_pct, 100)}%` }}
              />
            </div>
            <span className="mt-1 block text-xs text-emerald-400">{summary.match_rate_pct}% of bank lines</span>
          </div>
        }
      />
      <Metric
        label="Exceptions"
        value={String(summary.exceptions)}
        icon={<AlertIcon className="h-4 w-4" />}
        tint="bg-amber-500/20"
      />
      <Metric
        label="Unreconciled difference"
        value={formatInr(difference)}
        icon={<ScaleIcon className="h-4 w-4" />}
        tint={reconciled ? "bg-emerald-500/20" : "bg-rose-500/20"}
        sub={
          <div className="relative mt-1">
            <Badge tone={reconciled ? "good" : "bad"}>{reconciled ? "Reconciled" : "Investigate"}</Badge>
          </div>
        }
      />
    </div>
  )
}
