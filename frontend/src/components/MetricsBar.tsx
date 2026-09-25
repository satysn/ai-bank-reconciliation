import type { Summary } from "../api/types"
import { formatInr } from "../format"
import { Badge, Card } from "./ui"

function Metric({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-2xl font-semibold text-slate-50">{value}</span>
      {sub}
    </Card>
  )
}

export function MetricsBar({ summary, difference }: { summary: Summary; difference: number }) {
  const reconciled = Math.abs(difference) < 0.01
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <Metric label="Bank lines" value={String(summary.bank_transactions)} />
      <Metric label="Ledger entries" value={String(summary.ledger_entries)} />
      <Metric
        label="Auto-matched"
        value={String(summary.auto_matched_pairs)}
        sub={
          <div className="mt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(summary.match_rate_pct, 100)}%` }}
              />
            </div>
            <span className="mt-1 block text-xs text-emerald-400">{summary.match_rate_pct}% of bank lines</span>
          </div>
        }
      />
      <Metric label="Exceptions" value={String(summary.exceptions)} />
      <Metric
        label="Unreconciled difference"
        value={formatInr(difference)}
        sub={
          <Badge tone={reconciled ? "good" : "bad"}>
            {reconciled ? "Reconciled" : "Investigate"}
          </Badge>
        }
      />
    </div>
  )
}
