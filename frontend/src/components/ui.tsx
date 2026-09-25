import type { ReactNode } from "react"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900/50 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-colors hover:border-white/20 ${className}`}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "good" | "warn" | "bad"
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-800 text-slate-300 ring-1 ring-inset ring-white/10",
    good: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
    warn: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/30",
    bad: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "secondary" | "ghost"
  className?: string
  type?: "button" | "submit"
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/40 hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-700/40 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none",
    secondary:
      "bg-white/5 text-slate-100 ring-1 ring-inset ring-white/10 hover:bg-white/10 disabled:bg-transparent disabled:text-slate-600",
    ghost: "bg-transparent hover:bg-white/5 text-slate-300 disabled:text-slate-600",
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <span className="font-semibold">Error: </span>
      {message}
    </div>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-sm">{children}</table>
    </div>
  )
}
