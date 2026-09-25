// Minimal inline icon set (stroke-based, currentColor) — avoids an icon-library dependency.
type IconProps = { className?: string }

const base = "stroke-current"

export function BankIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path d="M3 10l9-6 9 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10h16v9H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16M8 13v4M12 13v4M16 13v4" strokeLinecap="round" />
    </svg>
  )
}

export function LedgerIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  )
}

export function MatchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function AlertIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path d="M12 3l9.5 17H2.5L12 3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  )
}

export function ScaleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path d="M12 3v18M7 21h10" strokeLinecap="round" />
      <path d="M5 7l-3 6a3 3 0 006 0l-3-6zM19 7l-3 6a3 3 0 006 0l-3-6z" strokeLinejoin="round" />
      <path d="M4 7h16M12 3l4 4-4 4-4-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SparkleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.8 5.6L19 9.5l-5.2 1.9L12 17l-1.8-5.6L5 9.5l5.2-1.9L12 2z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" opacity={0.7} />
    </svg>
  )
}

export function ChatIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path
        d="M4 5h16v11H8l-4 4V5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LinkIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path
        d="M9 15l6-6M8 13l-2 2a3.5 3.5 0 005 5l3-3M16 11l2-2a3.5 3.5 0 00-5-5l-3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UploadIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`${base} ${className}`}>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
