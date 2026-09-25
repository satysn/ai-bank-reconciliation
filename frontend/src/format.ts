const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatInr(n: number): string {
  const sign = n < 0 ? "-" : ""
  return `${sign}₹${inr.format(Math.abs(n))}`
}

export function csvEscape(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","))
  }
  return lines.join("\n")
}

export function downloadText(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
