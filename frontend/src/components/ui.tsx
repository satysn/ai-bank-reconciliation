import type { ReactNode } from "react"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm ${className}`}>
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
    neutral: "bg-slate-800 text-slate-300",
    good: "bg-emerald-900/60 text-emerald-300",
    warn: "bg-amber-900/60 text-amber-300",
    bad: "bg-rose-900/60 text-rose-300",
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
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-900",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 disabled:bg-slate-900",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300 disabled:text-slate-600",
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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
    <div className="rounded-lg border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
      <span className="font-semibold">Error: </span>
      {message}
    </div>
  )
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">{children}</table>
    </div>
  )
}
