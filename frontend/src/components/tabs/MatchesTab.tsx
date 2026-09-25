import type { MatchRow } from "../../api/types"
import { Badge, Table } from "../ui"

const PASS_TONE: Record<string, "good" | "neutral" | "warn"> = {
  exact: "good",
  window: "neutral",
  near: "warn",
}

const COLUMNS: { key: keyof MatchRow; label: string }[] = [
  { key: "txn_id", label: "Txn" },
  { key: "entry_id", label: "Entry" },
  { key: "match_pass", label: "Pass" },
  { key: "bank_date", label: "Bank date" },
  { key: "ledger_date", label: "Ledger date" },
  { key: "date_gap_days", label: "Gap (days)" },
  { key: "desc_similarity", label: "Similarity" },
  { key: "bank_amount", label: "Bank amount" },
  { key: "ledger_amount", label: "Ledger amount" },
  { key: "difference", label: "Difference" },
  { key: "bank_description", label: "Bank description" },
  { key: "ledger_description", label: "Ledger description" },
]

export function MatchesTab({ matches }: { matches: MatchRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        How each pair was matched. <strong className="text-slate-200">exact</strong> = same
        reference and amount; <strong className="text-slate-200">window</strong> = same amount
        within the date window; <strong className="text-slate-200">near</strong> = same reference
        or similar description but a different amount (flagged as an exception).
      </p>
      <Table>
        <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {matches.map((m, i) => (
            <tr key={`${m.txn_id}-${m.entry_id}-${i}`} className="transition-colors hover:bg-white/[0.04]">
              {COLUMNS.map((c) =>
                c.key === "match_pass" ? (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2">
                    <Badge tone={PASS_TONE[m.match_pass] ?? "neutral"}>{m.match_pass}</Badge>
                  </td>
                ) : (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-300">
                    {m[c.key]}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
