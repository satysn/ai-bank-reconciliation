import { useState } from "react"
import { explain as explainApi } from "../../api/client"
import type { Explanation, ExceptionRow, ReconContext } from "../../api/types"
import { EXCEPTION_LABELS } from "../../api/types"
import { formatInr } from "../../format"
import { SparkleIcon } from "../icons"
import { Badge, Button, ErrorBanner, Spinner } from "../ui"

const CONFIDENCE_TONE: Record<string, "good" | "warn" | "bad"> = {
  high: "good",
  medium: "warn",
  low: "bad",
}

const FIXES_ACCENT: Record<string, string> = {
  books: "before:bg-amber-500",
  bank_side: "before:bg-sky-500",
  investigate: "before:bg-rose-500",
}

function ExplanationView({ x }: { x: Explanation }) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 text-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">
        <SparkleIcon className="h-3.5 w-3.5" /> AI explanation
      </div>
      <p>
        <span className="font-semibold text-slate-200">What happened: </span>
        <span className="text-slate-300">{x.explanation}</span>
      </p>
      <p>
        <span className="font-semibold text-slate-200">Likely cause: </span>
        <span className="text-slate-300">{x.likely_cause}</span>
      </p>
      <p>
        <span className="font-semibold text-slate-200">Recommended action: </span>
        <span className="text-slate-300">{x.recommended_action}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Source: {x.source}</span>
        <Badge tone={CONFIDENCE_TONE[x.confidence] ?? "neutral"}>confidence: {x.confidence}</Badge>
        <span>entry check: {x.validation}</span>
      </div>
      {x.journal_entry && (
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-slate-300">
{`Dr  ${x.journal_entry.debit_account.padEnd(32)} ${x.journal_entry.amount.toFixed(2).padStart(12)}
    Cr  ${x.journal_entry.credit_account.padEnd(28)} ${x.journal_entry.amount.toFixed(2).padStart(12)}
(${x.journal_entry.narration})`}
        </pre>
      )}
    </div>
  )
}

export function ExceptionsTab({
  exceptions,
  ctx,
}: {
  exceptions: ExceptionRow[]
  ctx: ReconContext | null
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [explanations, setExplanations] = useState<Record<string, Explanation>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [explainAllProgress, setExplainAllProgress] = useState<string | null>(null)

  async function explainOne(id: string) {
    setLoading((s) => new Set(s).add(id))
    setErrors((e) => ({ ...e, [id]: "" }))
    try {
      const result = await explainApi(id, ctx)
      setExplanations((m) => ({ ...m, [id]: result }))
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : String(err) }))
    } finally {
      setLoading((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  async function explainAll() {
    for (let i = 0; i < exceptions.length; i++) {
      const id = exceptions[i].exception_id
      setExplainAllProgress(`${i + 1} of ${exceptions.length}`)
      // Sequential on purpose: the Gemini free tier allows only a few
      // requests per minute, so firing these in parallel just trades a
      // slower-but-reliable run for a burst of guardrail-fallback answers.
      await explainOne(id)
    }
    setExplainAllProgress(null)
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{exceptions.length} exceptions found</p>
        <Button onClick={explainAll} disabled={explainAllProgress !== null}>
          {explainAllProgress ? (
            <span className="flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Explaining {explainAllProgress}...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <SparkleIcon className="h-4 w-4" /> Explain all exceptions with AI
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {exceptions.map((e) => {
          const isOpen = expanded.has(e.exception_id)
          const isLoading = loading.has(e.exception_id)
          const explanation = explanations[e.exception_id]
          const error = errors[e.exception_id]
          const accent = FIXES_ACCENT[e.fixes] ?? "before:bg-slate-500"
          return (
            <div
              key={e.exception_id}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/50 transition-colors hover:border-white/20 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}`}
            >
              <button
                onClick={() => toggle(e.exception_id)}
                className="flex w-full items-center justify-between px-4 py-3 pl-5 text-left"
              >
                <span className="text-sm text-slate-200">
                  <span className="font-mono text-slate-500">{e.exception_id}</span>
                  {" · "}
                  {EXCEPTION_LABELS[e.type] ?? e.type}
                  {" · "}
                  <span className={`font-mono ${e.amount < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                    {formatInr(e.amount)}
                  </span>
                </span>
                <span
                  className={`text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                >
                  +
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 px-4 py-3 pl-5">
                  <p className="text-sm text-slate-300">{e.detail}</p>
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      onClick={() => explainOne(e.exception_id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <Spinner className="h-4 w-4" /> Thinking...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <SparkleIcon className="h-4 w-4 text-indigo-400" /> Explain with AI
                        </span>
                      )}
                    </Button>
                  </div>
                  {error && (
                    <div className="mt-3">
                      <ErrorBanner message={error} />
                    </div>
                  )}
                  {explanation && <ExplanationView x={explanation} />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
