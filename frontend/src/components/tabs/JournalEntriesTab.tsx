import type { JournalEntryRow } from "../../api/types"
import { downloadText, formatInr, toCsv } from "../../format"
import { Button, Card, Table } from "../ui"

export function JournalEntriesTab({
  entries,
  approved,
  onToggle,
}: {
  entries: JournalEntryRow[]
  approved: Set<string>
  onToggle: (exceptionId: string) => void
}) {
  const approvedRows = entries.filter((e) => approved.has(e.exception_id))

  function download() {
    const csv = toCsv(
      approvedRows.map((e) => ({
        exception_id: e.exception_id,
        debit_account: e.debit_account,
        credit_account: e.credit_account,
        amount: e.amount,
        narration: e.narration,
        status: "Approved",
      })),
    )
    downloadText("approved_journal_entries.csv", csv)
  }

  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">No book-side adjustments needed.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Proposed adjusting entries. Nothing is posted until a reviewer approves it.
      </p>
      <Table>
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Approve</th>
            <th className="px-3 py-2 text-left">Exception</th>
            <th className="px-3 py-2 text-left">Debit</th>
            <th className="px-3 py-2 text-left">Credit</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">Narration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {entries.map((e) => (
            <tr key={e.exception_id} className="hover:bg-slate-900/60">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={approved.has(e.exception_id)}
                  onChange={() => onToggle(e.exception_id)}
                  className="h-4 w-4 accent-indigo-500"
                />
              </td>
              <td className="px-3 py-2 text-slate-300">{e.exception_id}</td>
              <td className="px-3 py-2 text-slate-300">{e.debit_account}</td>
              <td className="px-3 py-2 text-slate-300">{e.credit_account}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-200">{formatInr(e.amount)}</td>
              <td className="px-3 py-2 text-slate-400">{e.narration}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">
          Approved {approvedRows.length} of {entries.length}
        </span>
        <Button onClick={download} disabled={approvedRows.length === 0}>
          Download approved entries (CSV)
        </Button>
      </div>
    </div>
  )
}
