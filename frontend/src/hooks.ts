import { useEffect, useState } from "react"

/** Delays reflecting a fast-changing value (e.g. a slider) so callers don't
 * refetch on every intermediate frame while the user is still dragging. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
