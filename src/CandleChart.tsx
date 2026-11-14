import { useMemo, useState } from 'react'
import { formatDate, formatHour } from './time'
import type { Indicator, MarketCandle } from './types'

interface CandleChartProps {
  candles: MarketCandle[]
  indicators: Indicator[]
  interval: '1m' | '5m'
}

const width = 1000
const left = 60
const right = 26
const priceTop = 28
const priceBottom = 283
const volumeTop = 311
const volumeBottom = 380
const chartWidth = width - left - right

const priceFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const volumeFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export default function CandleChart({ candles, indicators, interval }: CandleChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const visible = useMemo(() => candles.slice(-110), [candles])
  const selected = hoveredIndex !== null ? visible[hoveredIndex] : visible.at(-1)
  const indicatorMap = useMemo(() => new Map(indicators.filter((row) => row.value !== null).map((row) => [row.openTime, row.value as number])), [indicators])

  if (visible.length === 0) {
    return <div className="chart-empty">Chưa có nến trong khoảng thời gian này. Chọn ngày khác hoặc chạy batch xử lý dữ liệu.</div>
  }

  const maValues = interval === '1m' ? visible.map((row) => indicatorMap.get(row.openTime)) : []
  const prices = visible.flatMap((row) => [row.high, row.low])
  for (const value of maValues) if (value !== undefined) prices.push(value)
  const rawMin = Math.min(...prices)
  const rawMax = Math.max(...prices)
  const padding = Math.max((rawMax - rawMin) * 0.1, rawMax * 0.0002, 1)
  const minPrice = rawMin - padding
  const maxPrice = rawMax + padding
  const maxVolume = Math.max(...visible.map((row) => row.volume), 1)
  const step = chartWidth / visible.length
  const candleWidth = Math.max(2, Math.min(step * 0.58, 12))
  const x = (index: number) => left + (index + 0.5) * step
  const y = (price: number) => priceBottom - (price - minPrice) / (maxPrice - minPrice) * (priceBottom - priceTop)
  const gridPrices = Array.from({ length: 5 }, (_, index) => minPrice + (maxPrice - minPrice) * (4 - index) / 4)
  const timeTickIndexes = Array.from(new Set([0, Math.floor((visible.length - 1) / 4), Math.floor((visible.length - 1) / 2), Math.floor((visible.length - 1) * 3 / 4), visible.length - 1]))
  const maPoints = visible.map((_, index) => ({ value: maValues[index], index })).filter((point) => point.value !== undefined)
  const maPath = maPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.index)} ${y(point.value as number)}`).join(' ')
  const selectedChange = selected ? (selected.close - selected.open) / selected.open * 100 : 0

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <div className="chart-legend-main">
          <span className="legend-dot green" /> Giá đóng <strong>{selected ? priceFormatter.format(selected.close) : '—'}</strong>
          {selected && <span className={selectedChange >= 0 ? 'positive' : 'negative'}>{selectedChange >= 0 ? '+' : ''}{selectedChange.toFixed(2)}%</span>}
          {interval === '1m' && <span className="ma-legend"><span className="legend-line" /> MA20 <strong>{selected && indicatorMap.get(selected.openTime) !== undefined ? priceFormatter.format(indicatorMap.get(selected.openTime)!) : '—'}</strong></span>}
        </div>
        <span className="chart-selected-time">{selected ? formatDate(selected.openTime) : '—'} · GMT+7</span>
      </div>
      <svg className="candle-svg" viewBox="0 0 1000 412" role="img" aria-label={`Biểu đồ nến ${interval} gồm ${visible.length} bản ghi`}>
        {gridPrices.map((price, index) => (
          <g key={index}>
            <line x1={left} x2={width - right} y1={y(price)} y2={y(price)} className="chart-grid" />
            <text x={left - 12} y={y(price) + 4} textAnchor="end" className="chart-axis">{priceFormatter.format(price)}</text>
          </g>
        ))}
        <text x={left - 12} y={volumeTop + 3} textAnchor="end" className="chart-axis">VOL</text>
        <text x={left - 12} y={volumeBottom} textAnchor="end" className="chart-axis">{volumeFormatter.format(maxVolume)}</text>
        <line x1={left} x2={width - right} y1={priceBottom + 14} y2={priceBottom + 14} className="chart-divider" />
        {selected && hoveredIndex !== null && <line x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1={priceTop} y2={volumeBottom} className="chart-crosshair" />}
        {visible.map((row, index) => {
          const center = x(index)
          const green = row.close >= row.open
          const bodyTop = y(Math.max(row.open, row.close))
          const bodyBottom = y(Math.min(row.open, row.close))
          const volumeHeight = row.volume / maxVolume * (volumeBottom - volumeTop)
          return (
            <g key={`${row.symbol}-${row.openTime}`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
              <line x1={center} x2={center} y1={y(row.high)} y2={y(row.low)} className={green ? 'wick-up' : 'wick-down'} />
              <rect x={center - candleWidth / 2} y={bodyTop} width={candleWidth} height={Math.max(1.5, bodyBottom - bodyTop)} rx="1" className={green ? 'candle-up' : 'candle-down'} />
              <rect x={center - candleWidth / 2} y={volumeBottom - volumeHeight} width={candleWidth} height={Math.max(1, volumeHeight)} className={green ? 'volume-up' : 'volume-down'} />
              <rect x={center - step / 2} y={priceTop} width={step} height={volumeBottom - priceTop} fill="transparent" />
            </g>
          )
        })}
        {interval === '1m' && maPoints.length > 1 && <path d={maPath} className="ma-path" />}
        {timeTickIndexes.map((index) => <text key={index} x={x(index)} y="407" textAnchor={index === 0 ? 'start' : index === visible.length - 1 ? 'end' : 'middle'} className="chart-axis">{formatHour(visible[index].openTime)}</text>)}
      </svg>
      <div className="chart-footnote">{visible.length < candles.length ? `Đang hiển thị ${visible.length} nến cuối trong trang dữ liệu.` : `${visible.length} nến trong khung nhìn.`} {interval === '5m' ? 'MA20 hiện chỉ được tính cho nến 1 phút.' : ''}</div>
    </div>
  )
}
