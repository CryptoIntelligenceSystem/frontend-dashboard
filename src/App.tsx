import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronLeft, ChevronRight, Clock3, Database, ExternalLink, Layers3,
  Newspaper, Radio, RefreshCw, SearchX, Server, TrendingUp, Waves,
} from 'lucide-react'
import CandleChart from './CandleChart'
import { api } from './api'
import { formatDate, formatHour, suggestedRange, toLocalInput, toUtcIso } from './time'
import type { Indicator, MarketCandle, NewsArticle, NewsImpact, Page, PipelineStatus, Signal } from './types'

type Interval = '1m' | '5m'
type Section = 'status' | 'candles' | 'indicators' | 'signals' | 'news' | 'impact'
type Range = { from: string; to: string }

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function formatNumber(value: number | null | undefined): string { return value === null || value === undefined ? '—' : number.format(value) }
function formatCompact(value: number | null | undefined): string { return value === null || value === undefined ? '—' : compact.format(value) }
function message(error: unknown): string { return error instanceof Error ? error.message : 'Không tải được dữ liệu. Hãy thử làm mới.' }

function Panel({ title, eyebrow, icon, action, children, className = '', id }: {
  title: string; eyebrow?: string; icon: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return <section id={id} className={`panel ${className}`}>
    <div className="panel-header">
      <div className="panel-title-wrap"><span className="panel-icon">{icon}</span><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div></div>
      {action && <div className="panel-action">{action}</div>}
    </div>
    {children}
  </section>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><SearchX size={26} strokeWidth={1.5} /><p>{children}</p></div>
}

function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="error-box"><Activity size={18} /><span>{children}</span></div>
}

function Pager({ page, onChange }: { page: Page<unknown> | null; onChange: (offset: number) => void }) {
  if (!page || (page.offset === 0 && !page.hasMore)) return null
  return <div className="pager">
    <span>Trang {Math.floor(page.offset / page.limit) + 1}</span>
    <div>
      <button type="button" aria-label="Trang trước" disabled={page.offset === 0} onClick={() => onChange(Math.max(0, page.offset - page.limit))}><ChevronLeft size={16} /></button>
      <button type="button" aria-label="Trang sau" disabled={!page.hasMore} onClick={() => onChange(page.nextOffset ?? page.offset)}><ChevronRight size={16} /></button>
    </div>
  </div>
}

function App() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState<Interval>('1m')
  const [range, setRange] = useState<Range | null>(null)
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [candles, setCandles] = useState<MarketCandle[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [newsPage, setNewsPage] = useState<Page<NewsArticle> | null>(null)
  const [impactPage, setImpactPage] = useState<Page<NewsImpact> | null>(null)
  const [newsOffset, setNewsOffset] = useState(0)
  const [impactOffset, setImpactOffset] = useState(0)
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({})
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api.status(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setStatus(result)
        const initial = suggestedRange(result)
        setRange(initial)
        setDraftFrom(initial.from)
        setDraftTo(initial.to)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setErrors((previous) => ({ ...previous, status: message(error) }))
        const fallback = { from: toLocalInput(new Date(Date.now() - 3 * 3_600_000)), to: toLocalInput(new Date()) }
        setRange(fallback)
        setDraftFrom(fallback.from)
        setDraftTo(fallback.to)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!range) return
    const controller = new AbortController()
    const from = toUtcIso(range.from)
    const to = toUtcIso(range.to)
    if (!from || !to) return
    setLoading(true)
    setErrors({})
    setCandles([])
    setIndicators([])
    setSignals([])
    setNewsPage(null)
    setImpactPage(null)

    async function load<T>(section: Section, request: Promise<T>, update: (data: T) => void) {
      try {
        const result = await request
        if (!controller.signal.aborted) update(result)
      } catch (error) {
        if (!controller.signal.aborted) setErrors((previous) => ({ ...previous, [section]: message(error) }))
      }
    }

    void Promise.all([
      load('status', api.status(controller.signal), setStatus),
      load('candles', api.candles(symbol, interval, from, to, controller.signal), (page) => setCandles(page.data)),
      load('indicators', api.indicators(symbol, from, to, controller.signal), (page) => setIndicators(page.data)),
      load('signals', api.signals(symbol, from, to, controller.signal), (page) => setSignals(page.data)),
      load('news', api.news(symbol, from, to, newsOffset, controller.signal), setNewsPage),
      load('impact', api.impact(symbol, from, to, impactOffset, controller.signal), setImpactPage),
    ]).then(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [range, symbol, interval, newsOffset, impactOffset, refreshKey])

  const latest = candles.at(-1)
  const previous = candles.at(-2)
  const changePct = latest && previous ? (latest.close - previous.close) / previous.close * 100 : null
  const volume = useMemo(() => candles.reduce((total, row) => total + row.volume, 0), [candles])
  const latestMa = useMemo(() => indicators.filter((row) => row.value !== null).at(-1), [indicators])
  const latestImpact = impactPage?.data[0]
  const selectedRangeEnd = range ? toUtcIso(range.to) : null

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const from = toUtcIso(draftFrom)
    const to = toUtcIso(draftTo)
    if (!from || !to || new Date(from) >= new Date(to)) {
      setRangeError('Thời gian bắt đầu phải sớm hơn thời gian kết thúc.')
      return
    }
    setRangeError('')
    setNewsOffset(0)
    setImpactOffset(0)
    setRange({ from: draftFrom, to: draftTo })
  }

  function resetRange() {
    if (!status) return
    const next = suggestedRange(status)
    setDraftFrom(next.from)
    setDraftTo(next.to)
    setRangeError('')
    setNewsOffset(0)
    setImpactOffset(0)
    setRange(next)
  }

  function changeSymbol(next: string) { setSymbol(next); setNewsOffset(0); setImpactOffset(0) }
  const navigate = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Waves size={21} strokeWidth={2.7} /></span><div><strong>CRYPT<span>IQ</span></strong><small>INTELLIGENCE SYSTEM</small></div></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Điều hướng">
        <button className="nav-item active" type="button" onClick={() => navigate('overview')}><Layers3 size={18} /> Tổng quan</button>
        <button className="nav-item" type="button" onClick={() => navigate('market')}><BarChart3 size={18} /> Thị trường</button>
        <button className="nav-item" type="button" onClick={() => navigate('signals')}><Activity size={18} /> Tín hiệu</button>
        <button className="nav-item" type="button" onClick={() => navigate('news')}><Newspaper size={18} /> Tin tức</button>
        <button className="nav-item" type="button" onClick={() => navigate('impact')}><TrendingUp size={18} /> News Impact</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="service-card"><span className={`service-dot ${status && !errors.status ? 'online' : 'offline'}`} /><div><strong>{status && !errors.status ? 'API đã kết nối' : 'Chưa kết nối API'}</strong><small>Backend API · ClickHouse</small></div></div>
        <div className="sidebar-caption">Dữ liệu phân tích · GMT+7</div>
      </div>
    </aside>

    <main className="main-content" id="overview">
      <header className="topbar">
        <div className="breadcrumbs">Workspace <ChevronRight size={14} /> <span>Dashboard</span></div>
        <div className="topbar-right"><span className="timezone"><Clock3 size={15} /> Asia/Ho_Chi_Minh</span><button className="refresh-button" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || !range}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Làm mới</button></div>
      </header>

      <div className="page-content">
        <div className="hero">
          <div><div className="hero-kicker"><span className="kicker-line" /> MARKET INTELLIGENCE / DASHBOARD</div><h1>Toàn cảnh thị trường<span>.</span></h1><p>Giá, chỉ báo, tín hiệu và tin tức trong một luồng dữ liệu có thể kiểm chứng.</p></div>
          <div className="hero-side"><div className="hero-badge"><Radio size={15} /> {status && !errors.status ? 'Dữ liệu từ ClickHouse' : 'Chờ kết nối Backend'}</div><span>Khoảng chọn đến: {formatDate(selectedRangeEnd)} GMT+7</span></div>
        </div>

        <form className="filter-bar" onSubmit={applyRange}>
          <div className="filter-item symbol-filter"><label htmlFor="symbol">CẶP GIAO DỊCH</label><select id="symbol" value={symbol} onChange={(event) => changeSymbol(event.target.value)}><option value="BTCUSDT">₿ &nbsp; BTC / USDT</option><option value="ETHUSDT">Ξ &nbsp; ETH / USDT</option></select></div>
          <div className="filter-item"><label htmlFor="from">TỪ NGÀY · GIỜ MÁY</label><div className="input-icon"><CalendarDays size={16} /><input id="from" type="datetime-local" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} required /></div></div>
          <div className="filter-item"><label htmlFor="to">ĐẾN NGÀY · GIỜ MÁY</label><div className="input-icon"><CalendarDays size={16} /><input id="to" type="datetime-local" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} required /></div></div>
          <button className="apply-button" type="submit" disabled={!range}>Áp dụng <ArrowRight size={16} /></button>
          <button className="reset-button" type="button" onClick={resetRange} disabled={!status} title="Về khoảng thời gian có dữ liệu gần nhất">Gần nhất</button>
        </form>
        {rangeError && <ErrorBox>{rangeError}</ErrorBox>}
        {errors.status && <ErrorBox>{errors.status}</ErrorBox>}

        <div className="stats-grid">
          <div className="stat-card"><div className="stat-top"><span>GIÁ ĐÓNG GẦN NHẤT</span><span className="stat-icon violet"><TrendingUp size={18} /></span></div><strong>{formatNumber(latest?.close)} <small>USDT</small></strong><div className="stat-bottom">{changePct !== null ? <span className={changePct >= 0 ? 'stat-change positive' : 'stat-change negative'}>{changePct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(changePct).toFixed(2)}%</span> : <span className="muted">—</span>}<span>so với nến trước</span></div></div>
          <div className="stat-card"><div className="stat-top"><span>KHỐI LƯỢNG HIỂN THỊ</span><span className="stat-icon blue"><BarChart3 size={18} /></span></div><strong>{formatCompact(volume || null)} <small>{symbol.startsWith('BTC') ? 'BTC' : 'ETH'}</small></strong><div className="stat-bottom"><span>{candles.length} nến {interval}</span><span>trong trang hiện tại</span></div></div>
          <div className="stat-card"><div className="stat-top"><span>MA20 · NẾN 1 PHÚT</span><span className="stat-icon amber"><Activity size={18} /></span></div><strong>{formatNumber(latestMa?.value)} <small>USDT</small></strong><div className="stat-bottom"><span>{latestMa ? formatHour(latestMa.openTime) : 'Chưa đủ 20 nến'}</span><span>giá trị gần nhất</span></div></div>
          <div className="stat-card"><div className="stat-top"><span>TÍN HIỆU BẤT THƯỜNG</span><span className="stat-icon green"><Waves size={18} /></span></div><strong>{signals.length} <small>tín hiệu</small></strong><div className="stat-bottom"><span>{signals.length > 0 ? formatDate(signals[0].openTime) : 'Không phát hiện'}</span><span>trong khoảng chọn</span></div></div>
        </div>

        <div className="primary-grid">
          <Panel id="market" title="Biểu đồ giá" eyebrow="MARKET OVERVIEW" icon={<BarChart3 size={18} />} className="chart-panel" action={<div className="segmented" role="group" aria-label="Khung nến"><button type="button" className={interval === '1m' ? 'selected' : ''} onClick={() => setInterval('1m')}>1 phút</button><button type="button" className={interval === '5m' ? 'selected' : ''} onClick={() => setInterval('5m')}>5 phút</button></div>}>
            {errors.candles ? <ErrorBox>{errors.candles}</ErrorBox> : loading ? <div className="loading-surface">Đang tải dữ liệu nến…</div> : <CandleChart candles={candles} indicators={indicators} interval={interval} />}
            {candles.length === 500 && <p className="section-note">API giới hạn 500 nến mỗi lần. Thu hẹp khoảng thời gian để xem đầy đủ hơn.</p>}
          </Panel>
          <Panel title="Pipeline dữ liệu" eyebrow="SYSTEM SNAPSHOT" icon={<Server size={18} />} className="pipeline-panel" action={<span className={`status-pill ${status && !errors.status ? 'ready' : ''}`}><span />{status && !errors.status ? 'API hoạt động' : 'Ngoại tuyến'}</span>}>
            <div className="pipeline-flow"><span>Collector</span><ArrowRight size={15} /><span>Kafka</span><ArrowRight size={15} /><span>ClickHouse</span></div>
            <div className="pipeline-metrics"><div><span>Nến gốc 1m</span><strong>{formatCompact(status?.marketDataCount)}</strong></div><div><span>Nến gộp 5m</span><strong>{formatCompact(status?.candle5mCount)}</strong></div><div><span>Chỉ báo MA20</span><strong>{formatCompact(status?.indicatorCount)}</strong></div><div><span>Bài viết tin tức</span><strong>{formatCompact(status?.newsDataCount)}</strong></div></div>
            <div className="pipeline-latest"><Clock3 size={15} /><span>Nến 5m gần nhất</span><strong>{formatDate(status?.latestCandle5mTime)}</strong></div>
            <p className="pipeline-disclaimer">Bộ đếm là số dòng trong ClickHouse, không phản ánh tốc độ cập nhật trực tiếp.</p>
          </Panel>
        </div>

        <div className="section-heading" id="signals"><div><span className="eyebrow">DETECTION & EVENTS</span><h2>Tín hiệu & tin tức</h2></div><span>Đọc từ ClickHouse theo khoảng thời gian đã chọn</span></div>
        <div className="secondary-grid">
          <Panel title="Volume bất thường" icon={<Activity size={18} />} action={<span className="small-count">{signals.length} tín hiệu</span>}>
            {errors.signals ? <ErrorBox>{errors.signals}</ErrorBox> : loading ? <div className="loading-surface small">Đang tải tín hiệu…</div> : signals.length === 0 ? <Empty>Không có tín hiệu volume bất thường trong khoảng thời gian này.</Empty> : <div className="signal-list">{signals.slice(0, 6).map((row) => <div className="signal-row" key={`${row.symbol}-${row.openTime}`}><span className="signal-badge"><Activity size={17} /></span><div className="signal-info"><strong>{row.symbol} <span>· Volume anomaly</span></strong><small>{formatDate(row.openTime)} GMT+7</small></div><div className="signal-values"><strong>{formatCompact(row.value)}</strong><small>Ngưỡng {formatCompact(row.threshold)}</small></div></div>)}</div>}
            {signals.length > 6 && <p className="section-note">Hiển thị 6/{signals.length} tín hiệu gần nhất.</p>}
          </Panel>
          <Panel id="news" title="Tin tức liên quan" icon={<Newspaper size={18} />} action={<span className="small-count">CoinDesk · {symbol}</span>}>
            {errors.news ? <ErrorBox>{errors.news}</ErrorBox> : loading ? <div className="loading-surface small">Đang tải tin tức…</div> : !newsPage || newsPage.data.length === 0 ? <Empty>Chưa có bài viết gắn với {symbol} trong khoảng thời gian này.</Empty> : <div className="news-list">{newsPage.data.map((article) => <article className="news-row" key={`${article.source}-${article.articleId}`}><div className="news-meta"><span className="news-source">{article.source}</span><span>· {formatDate(article.publishedAt)} GMT+7</span></div><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title} <ExternalLink size={14} /></a><p>{article.summary}</p></article>)}</div>}
            <Pager page={newsPage} onChange={setNewsOffset} />
          </Panel>
        </div>

        <Panel id="impact" title="Biến động giá sau tin" eyebrow="NEWS IMPACT · TIME COMPARISON" icon={<TrendingUp size={18} />} className="impact-panel" action={<span className="small-count">5 / 15 / 60 phút</span>}>
          <p className="impact-intro">So sánh giá đóng trước khi bài viết xuất hiện với giá sau từng mốc thời gian. Kết quả chỉ mô tả biến động theo thời gian, không chứng minh tin tức gây ra thay đổi giá.</p>
          {errors.impact ? <ErrorBox>{errors.impact}</ErrorBox> : loading ? <div className="loading-surface small">Đang tải phân tích tin tức…</div> : !impactPage || impactPage.data.length === 0 ? <Empty>Chưa có kết quả News Impact trong khoảng thời gian này.</Empty> : <div className="table-scroll"><table><thead><tr><th>BÀI VIẾT</th><th>CẶP</th><th>MỐC</th><th>GIÁ TRƯỚC</th><th>GIÁ SAU</th><th>BIẾN ĐỘNG</th></tr></thead><tbody>{impactPage.data.map((row) => <tr key={`${row.source}-${row.articleId}-${row.symbol}-${row.horizonMinutes}`}><td><strong title={row.title}>{row.title}</strong><small>{formatDate(row.publishedAt)} GMT+7</small></td><td>{row.symbol}</td><td><span className="horizon-chip">+{row.horizonMinutes} phút</span></td><td>{formatNumber(row.baselineClose)}</td><td>{formatNumber(row.targetClose)}</td><td><span className={`return-badge ${row.returnPct >= 0 ? 'up' : 'down'}`}>{row.returnPct >= 0 ? '+' : ''}{row.returnPct.toFixed(3)}%</span></td></tr>)}</tbody></table></div>}
          <Pager page={impactPage} onChange={setImpactOffset} />
          {latestImpact && <div className="impact-footer"><Check size={15} /> Dữ liệu tính từ nến đã đóng · {latestImpact.source}</div>}
        </Panel>

        <footer className="footer"><div><Database size={15} /> Crypto Intelligence System <span>·</span> Dữ liệu theo UTC, hiển thị GMT+7</div><span>Backend API v1 · Spark + ClickHouse</span></footer>
      </div>
    </main>
  </div>
}

export default App
