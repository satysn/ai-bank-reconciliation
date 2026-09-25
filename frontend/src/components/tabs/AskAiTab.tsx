import { useState } from "react"
import { ask as askApi } from "../../api/client"
import type { ReconContext } from "../../api/types"
import { Button, ErrorBanner, Spinner } from "../ui"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
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
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-600">No messages yet — ask a question below.</p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-100"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300">
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
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
        />
        <Button onClick={send} disabled={sending || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}
