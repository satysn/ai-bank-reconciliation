import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { health, reconcileSample, reconcileUpload } from "./api/client"
import type { ReconContext } from "./api/types"
import { useDebouncedValue } from "./hooks"
import { Sidebar } from "./components/Sidebar"
import { MetricsBar } from "./components/MetricsBar"
import { ReconciliationTab } from "./components/tabs/ReconciliationTab"
import { ExceptionsTab } from "./components/tabs/ExceptionsTab"
import { JournalEntriesTab } from "./components/tabs/JournalEntriesTab"
import { MatchesTab } from "./components/tabs/MatchesTab"
import { AskAiTab } from "./components/tabs/AskAiTab"
import { ErrorBanner, Spinner } from "./components/ui"
import { AlertIcon, ChatIcon, LedgerIcon, LinkIcon, ScaleIcon } from "./components/icons"

const TABS = [
  { id: "brs", label: "Reconciliation statement", icon: ScaleIcon },
  { id: "exceptions", label: "Exceptions", icon: AlertIcon },
  { id: "journal", label: "Journal entries", icon: LedgerIcon },
  { id: "matches", label: "Matches", icon: LinkIcon },
  { id: "ask", label: "Ask AI", icon: ChatIcon },
] as const
type TabId = (typeof TABS)[number]["id"]

export default function App() {
  const [source, setSource] = useState<"sample" | "upload">("sample")
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [ledgerFile, setLedgerFile] = useState<File | null>(null)
  const [bankCsv, setBankCsv] = useState<string | null>(null)
  const [ledgerCsv, setLedgerCsv] = useState<string | null>(null)
  const [datasetVersion, setDatasetVersion] = useState(0)
  const [windowDays, setWindowDays] = useState(5)
  const [pct, setPct] = useState(5)
  const [openingBalance, setOpeningBalance] = useState(500_000)
  const [activeTab, setActiveTab] = useState<TabId>("brs")
  const [approved, setApproved] = useState<Set<string>>(new Set())

  const debouncedWindow = useDebouncedValue(windowDays, 400)
  const debouncedPct = useDebouncedValue(pct, 400)

  const healthQuery = useQuery({ queryKey: ["health"], queryFn: health })

  const resultKey = `${source}-${datasetVersion}-${debouncedWindow}-${debouncedPct}`

  const reconcileQuery = useQuery({
    queryKey: ["reconcile", source, datasetVersion, debouncedWindow, debouncedPct, openingBalance],
    queryFn: () =>
      source === "sample"
        ? reconcileSample(debouncedWindow, debouncedPct, openingBalance)
        : reconcileUpload(bankFile!, ledgerFile!, debouncedWindow, debouncedPct, openingBalance),
    enabled: source === "sample" || (!!bankFile && !!ledgerFile),
  })

  // A new dataset/config invalidates prior approvals: they were approving
  // journal entries for a *different* set of exception IDs.
  useEffect(() => {
    setApproved(new Set())
  }, [resultKey])

  async function onBankFile(file: File) {
    setBankFile(file)
    setBankCsv(await file.text())
    setDatasetVersion((v) => v + 1)
  }

  async function onLedgerFile(file: File) {
    setLedgerFile(file)
    setLedgerCsv(await file.text())
    setDatasetVersion((v) => v + 1)
  }

  const ctx: ReconContext = useMemo(
    () => ({
      window: debouncedWindow,
      pct: debouncedPct,
      bank_csv: source === "upload" ? (bankCsv ?? undefined) : undefined,
      ledger_csv: source === "upload" ? (ledgerCsv ?? undefined) : undefined,
    }),
    [source, bankCsv, ledgerCsv, debouncedWindow, debouncedPct],
  )

  const data = reconcileQuery.data

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
            <ScaleIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="gradient-text">AI Bank Reconciliation</span>{" "}
              <span className="text-slate-100">Assistant</span>
            </h1>
            <p className="mt-0.5 max-w-3xl text-sm text-slate-400">
              Matches bank statement lines to ledger entries, classifies the differences, and uses
              an LLM to explain them and draft adjusting entries for approval.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
        <Sidebar
          source={source}
          onSourceChange={setSource}
          onBankFile={onBankFile}
          onLedgerFile={onLedgerFile}
          bankFileName={bankFile?.name}
          ledgerFileName={ledgerFile?.name}
          openingBalance={openingBalance}
          onOpeningBalanceChange={setOpeningBalance}
          windowDays={windowDays}
          onWindowChange={setWindowDays}
          pct={pct}
          onPctChange={setPct}
          health={healthQuery.data}
        />

        <main className="flex-1 min-w-0">
          {source === "upload" && (!bankFile || !ledgerFile) && (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
              Upload both files in the sidebar to start.
            </div>
          )}

          {reconcileQuery.isError && (
            <ErrorBanner
              message={reconcileQuery.error instanceof Error ? reconcileQuery.error.message : "Failed to reconcile"}
            />
          )}

          {reconcileQuery.isFetching && !data && (
            <div className="flex items-center gap-2 py-10 text-slate-400">
              <Spinner className="h-5 w-5" /> Reconciling...
            </div>
          )}

          {data && (
            <div className="flex flex-col gap-6 animate-fade-in-up">
              <div className="relative">
                {reconcileQuery.isFetching && (
                  <div className="absolute -top-2 right-0 flex items-center gap-1 text-xs text-slate-500">
                    <Spinner className="h-3 w-3" /> updating...
                  </div>
                )}
                <MetricsBar
                  summary={data.summary}
                  difference={data.bank_reconciliation_statement.difference}
                />
              </div>

              <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {TABS.map((t) => {
                  const Icon = t.icon
                  const isActive = activeTab === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/40"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {/* All tab panels stay mounted so AI explanations, chat history, and
                  approvals survive switching tabs; only remounted (via key) when
                  the underlying dataset/config actually changes. */}
              <div className={activeTab === "brs" ? "animate-fade-in-up" : "hidden"}>
                <ReconciliationTab brs={data.bank_reconciliation_statement} />
              </div>
              <div className={activeTab === "exceptions" ? "animate-fade-in-up" : "hidden"}>
                <ExceptionsTab key={resultKey} exceptions={data.exceptions} ctx={ctx} />
              </div>
              <div className={activeTab === "journal" ? "animate-fade-in-up" : "hidden"}>
                <JournalEntriesTab
                  entries={data.proposed_journal_entries}
                  approved={approved}
                  onToggle={(id) =>
                    setApproved((s) => {
                      const next = new Set(s)
                      next.has(id) ? next.delete(id) : next.add(id)
                      return next
                    })
                  }
                />
              </div>
              <div className={activeTab === "matches" ? "animate-fade-in-up" : "hidden"}>
                <MatchesTab matches={data.matches} />
              </div>
              <div className={activeTab === "ask" ? "animate-fade-in-up" : "hidden"}>
                <AskAiTab key={resultKey} ctx={ctx} openingBalance={openingBalance} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
