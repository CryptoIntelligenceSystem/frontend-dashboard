import type { PipelineStatus } from './types'

// ClickHouse DateTime64 values are returned without a suffix, but the schema stores UTC.
export function parseApiUtc(value: string | null | undefined): Date | null {
  if (!value) return null
  const normalized = value.trim().replace(' ', 'T')
  const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

const shortFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

export function formatDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiUtc(value)
  return date ? dateFormatter.format(date) : '—'
}

export function formatHour(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiUtc(value)
  return date ? shortFormatter.format(date) : '—'
}

// HTML datetime-local fields use the browser's local timezone. Convert explicitly to keep
// the chosen wall-clock time stable when the user edits the range.
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toUtcIso(localInput: string): string | null {
  const date = new Date(localInput)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function suggestedRange(status: PipelineStatus): { from: string; to: string } {
  const now = Date.now()
  const candidates = [status.latestMarketTime, status.latestCandle5mTime, status.latestIndicatorTime, status.latestSignalTime]
    .map(parseApiUtc)
    .filter((date): date is Date => date !== null && date.getTime() <= now + 86_400_000)
  const anchor = candidates.length > 0
    ? new Date(Math.max(...candidates.map((date) => date.getTime())))
    : new Date(now)
  return {
    from: toLocalInput(new Date(anchor.getTime() - 3 * 3_600_000)),
    to: toLocalInput(new Date(anchor.getTime() + 10 * 60_000)),
  }
}
