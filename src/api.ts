import type { Indicator, MarketCandle, NewsArticle, NewsImpact, Page, PipelineStatus, Signal } from './types'

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${baseUrl}/api/v1/${path}`, window.location.origin)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Không kết nối được Backend. Kiểm tra service backend ở cổng 5080.')
  }
  if (!response.ok) {
    if (response.status === 503) throw new Error('ClickHouse hiện không sẵn sàng. Hãy thử làm mới sau.')
    throw new Error(`API ${path} trả về lỗi HTTP ${response.status}.`)
  }
  return response.json() as Promise<T>
}

export const api = {
  status: (signal?: AbortSignal) => get<PipelineStatus>('status', undefined, signal),
  candles: (symbol: string, interval: '1m' | '5m', from: string, to: string, signal?: AbortSignal) =>
    get<Page<MarketCandle>>(interval === '1m' ? 'market/minute-candles' : 'market/candles',
      { symbol, interval, from, to, limit: 500 }, signal),
  indicators: (symbol: string, from: string, to: string, signal?: AbortSignal) =>
    get<Page<Indicator>>('indicators', { symbol, interval: '1m', name: 'ma20', from, to, limit: 500 }, signal),
  signals: (symbol: string, from: string, to: string, signal?: AbortSignal) =>
    get<Page<Signal>>('signals', { symbol, from, to, limit: 100 }, signal),
  news: (symbol: string, from: string, to: string, offset = 0, signal?: AbortSignal) =>
    get<Page<NewsArticle>>('news', { symbol, from, to, limit: 6, offset }, signal),
  impact: (symbol: string, from: string, to: string, offset = 0, signal?: AbortSignal) =>
    get<Page<NewsImpact>>('news/impact', { symbol, from, to, limit: 6, offset }, signal),
}
