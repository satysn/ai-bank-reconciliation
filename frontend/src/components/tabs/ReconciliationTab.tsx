import type { BrsReport } from "../../api/types"
import { formatInr } from "../../format"
import { BankIcon, LedgerIcon } from "../icons"
import { Card } from "../ui"

function LinesTable({
  title,
  caption,
  icon,
  lines,
  totalLabel,
  total,
}: {
  title: string
  caption: string
  icon: React.ReactNode
  lines: [string, number][]
  totalLabel: string
  total: number
}) {
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-indigo-400">{icon}</span>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      </div>
      <p className="mb-3 text-xs text-slate-500">{caption}</p>
      <div className="divide-y divide-white/10 text-sm">
        {lines.map(([item, amount]) => (
          <div key={item} className="flex justify-between py-2">
            <span className="text-slate-300">{item}</span>
            <span className={`font-mono ${amount < 0 ? "text-rose-300" : "text-slate-200"}`}>
              {formatInr(amount)}
            </span>
          </div>
        ))}
        <div className="flex justify-between pt-2 text-sm font-semibold">
          <span className="text-slate-100">{totalLabel}</span>
          <span className="font-mono gradient-text">{formatInr(total)}</span>
        </div>
      </div>
    </Card>
  )
}

export function ReconciliationTab({ brs }: { brs: BrsReport }) {
  const reconciled = Math.abs(brs.difference) < 0.01
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <LinesTable
          title="Bank side"
          caption="Timing differences: the books are right, the bank hasn't caught up."
          icon={<BankIcon className="h-4 w-4" />}
          lines={brs.bank_lines}
          totalLabel="Adjusted bank balance"
          total={brs.adjusted_bank}
        />
        <LinesTable
          title="Book side"
          caption="Items the books are missing or got wrong: these need journal entries."
          icon={<LedgerIcon className="h-4 w-4" />}
          lines={brs.book_lines}
          totalLabel="Adjusted book balance"
          total={brs.adjusted_book}
        />
      </div>
      {reconciled ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Adjusted balances agree. The account is reconciled.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Adjusted balances differ by {formatInr(brs.difference)}. This equals the unexplained
          item(s) {brs.unexplained_ids.join(", ")}, which must be investigated before month-end
          close.
        </div>
      )}
    </div>
  )
}
