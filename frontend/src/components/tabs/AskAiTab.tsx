import { useState } from "react"
import { ask as askApi } from "../../api/client"
import type { ReconContext } from "../../api/types"
import { SparkleIcon } from "../icons"
import { Button, ErrorBanner, Spinner } from "../ui"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "assistant") {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow shadow-indigo-900/40">
        <SparkleIcon className="h-3.5 w-3.5" />
      </div>
    )
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-white/10">
      You
    </div>
  )
}

export function AskAiTab({
  ctx,
  openingBalance,
}: {
  ctx: ReconContext | null
  openingBalance: number
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    const question = input.trim()
    if (!question || sending) return
    setInput("")
    setError(null)
    setMessages((m) => [...m, { role: "user", text: question }])
    setSending(true)
    try {
      const { answer } = await askApi(question, ctx, openingBalance)
      setMessages((m) => [...m, { role: "assistant", text: answer }])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[560px] flex-col gap-3">
      <p className="text-sm text-slate-400">
        Ask about this reconciliation. Answers are grounded in the data above.
        <br />
        <span className="text-slate-500">
          Try: <em>Which items need a journal entry?</em> &middot;{" "}
          <em>Why don't the balances agree?</em>
        </span>
      </p>
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-600">
            <SparkleIcon className="h-6 w-6 text-slate-700" />
            <p className="text-sm">No messages yet — ask a question below.</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <Avatar role={m.role} />
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "rounded-br-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/30"
                    : "rounded-bl-sm bg-white/[0.06] text-slate-100 ring-1 ring-inset ring-white/10"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-end gap-2">
              <Avatar role="assistant" />
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white/[0.06] px-3.5 py-2 text-sm text-slate-300 ring-1 ring-inset ring-white/10">
                <Spinner className="h-4 w-4" /> Thinking...
              </div>
            </div>
          )}
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Your question"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-500"
        />
        <Button onClick={send} disabled={sending || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}
