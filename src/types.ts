export interface Page<T> {
  data: T[]
  count: number
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number | null
}

export interface MarketCandle {
  symbol: string
  interval: string
  openTime: string
  closeTime: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  tradeCount: number
  candleCount?: number
  processedAt?: string
}

export interface Indicator {
  symbol: string
  interval: string
  name: string
  openTime: string
  value: number | null
  processedAt: string
}

export interface Signal {
  symbol: string
  signalType: string
  openTime: string
  value: number
  baselineMean: number
  baselineStddev: number
  threshold: number
  details: string
  detectedAt: string
}

export interface NewsArticle {
  source: string
  articleId: string
  title: string
  summary: string
  url: string
  publishedAt: string
  collectedAt: string
  symbols: string[]
  sentiment: string | null
}

export interface NewsImpact {
  source: string
  articleId: string
  title: string
  symbol: string
  publishedAt: string
  horizonMinutes: number
  baselineTime: string
  baselineClose: number
  targetTime: string
  targetClose: number
  returnPct: number
  calculatedAt: string
}

export interface PipelineStatus {
  marketDataCount: number
  newsDataCount: number
  candle5mCount: number
  indicatorCount: number
  signalCount: number
  latestMarketTime: string | null
  latestNewsTime: string | null
  latestCandle5mTime: string | null
  latestIndicatorTime: string | null
  latestSignalTime: string | null
}
