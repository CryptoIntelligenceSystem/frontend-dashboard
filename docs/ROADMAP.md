# frontend-dashboard — Lộ trình triển khai

> Tham chiếu: [infrastructure/docs/PROJECT_REVIEW.md](https://github.com/CryptoIntelligenceSystem/infrastructure/blob/main/docs/PROJECT_REVIEW.md). Repo này **tiêu thụ** API theo `infrastructure/contracts/v1/openapi.yaml`; type TypeScript sinh từ file đó, không định nghĩa tay.
> Lịch: tuần 1 = 19–25/10/2026. Phụ trách chính: **D (Frontend & Integration)**. Stack đề xuất (chờ Q7): React 18 + Vite + TypeScript + `lightweight-charts` + TanStack Query.

## 1. Mục tiêu cuối (khi demo)

- Dashboard một trang tại `http://localhost:5173` (dev) / `http://localhost:8088` (bản build, profile `app`):
  - Chọn symbol (BTCUSDT, ETHUSDT) và khung 1m / 5m.
  - Biểu đồ nến + volume, đường MA20, đánh dấu tín hiệu volume bất thường.
  - Danh sách tin tức liên quan symbol (tiêu đề, nguồn, thời gian, link).
  - Thanh trạng thái: "Cập nhật lần cuối", độ trễ (`/status`), cảnh báo khi dữ liệu cũ > 3 phút.
- Tự làm mới mỗi 15 s; xử lý trạng thái đang tải / rỗng / lỗi API.
- Chỉ gọi API thật qua `VITE_API_BASE_URL`; không có dữ liệu giả trong bản build.

## 2. Hiện trạng

- Repo chỉ có commit "Initial commit" và `README.md` rỗng (0 byte). Chưa có code, dependency, test, CI.
- API chưa tồn tại (backend-api trống) → phải phát triển trên mock sinh từ OpenAPI.

## 3. Kiến trúc và cấu trúc thư mục đề xuất

```
src/
  api/
    schema.d.ts          # sinh bằng openapi-typescript từ contracts/v1/openapi.yaml (không sửa tay)
    client.ts            # fetch wrapper, đọc VITE_API_BASE_URL, bóc envelope {data, meta} / {error}
    hooks.ts             # useCandles, useIndicators, useSignals, useNews, useStatus (TanStack Query, refetch 15 s)
  components/
    CandleChart.tsx      # lightweight-charts: nến + volume + MA20 + marker tín hiệu
    SymbolPicker.tsx, IntervalPicker.tsx, NewsList.tsx, StatusBar.tsx, SignalsPanel.tsx
  lib/time.ts            # ISO-8601 UTC → UTCTimestamp cho chart, hiển thị giờ VN
  App.tsx, main.tsx
contracts/v1/openapi.yaml  # bản vendor (scripts/sync-contracts.mjs)
mocks/                     # ví dụ response bổ sung cho Prism (nếu ví dụ trong OpenAPI chưa đủ)
tests/                     # vitest + Testing Library
Dockerfile (build → nginx:alpine, port 80 → host 8088), .env.example, README.md
.github/workflows/ci.yml
```

Lý do: type sinh từ hợp đồng tránh lệch với API; tách hooks khỏi component để test và đổi mock ↔ API thật chỉ bằng biến môi trường; `lightweight-charts` nhẹ, chuyên cho nến.

## 4. Milestone

### FE-M0 — Khung dự án và mock API
- **Tuần**: 3 · **Phụ trách**: D
- **Phụ thuộc**: INF-M0.2 (`openapi.yaml`), Q7.
- **Mock**: Prism `npx @stoplight/prism-cli mock contracts/v1/openapi.yaml -p 4010` (dùng ví dụ trong OpenAPI).

| Task | File | Mô tả | Công | Nhánh |
|---|---|---|---|---|
| FE-M0.1 | `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js` | Vite React TS, ESLint, Prettier, Vitest | S | `feat/fe-skeleton` |
| FE-M0.2 | `scripts/sync-contracts.mjs`, `src/api/schema.d.ts` | Vendor OpenAPI, `npm run gen:api` | S | `feat/fe-api-types` |
| FE-M0.3 | `src/api/client.ts` | Bóc envelope, ném lỗi có `code` | S | `feat/fe-api-types` |
| FE-M0.4 | `package.json` scripts | `npm run mock` (Prism :4010), `npm run dev` | S | `feat/fe-skeleton` |
| FE-M0.5 | `.github/workflows/ci.yml` | `npm ci`, lint, typecheck, test, build | S | `chore/ci-frontend` |

**Hoàn thành khi**:
```bash
npm ci && npm run lint && npm run typecheck && npm test -- --run && npm run build
npm run mock & curl -s "http://localhost:4010/api/v1/candles?symbol=BTCUSDT"      # trả ví dụ theo hợp đồng
```

### FE-M1 — Biểu đồ nến
- **Tuần**: 4 · **Phụ trách**: D
- **Phụ thuộc**: FE-M0. **Mock**: Prism; thêm `mocks/candles_btc_1m.json` (500 nến) để kiểm tra hiển thị.

| Task | File | Mô tả | Công | Nhánh |
|---|---|---|---|---|
| FE-M1.1 | `src/components/CandleChart.tsx`, `src/lib/time.ts` | Nến + volume histogram; chuyển `open_time` ISO → `UTCTimestamp` | M | `feat/fe-candle-chart` |
| FE-M1.2 | `SymbolPicker.tsx`, `IntervalPicker.tsx`, `hooks.ts` | `useCandles(symbol, interval)`, refetch 15 s, cập nhật nến cuối không vẽ lại toàn bộ | M | `feat/fe-candle-chart` |
| FE-M1.3 | `tests/time.test.ts`, `tests/CandleChart.test.tsx` | Chuyển đổi thời gian, render với dữ liệu mẫu, trạng thái rỗng/lỗi | S | `feat/fe-candle-chart` |

**Hoàn thành khi**: `npm test -- --run` xanh; với `npm run mock` + `npm run dev`, chuyển BTC/ETH và 1m/5m thấy biểu đồ đổi, tab Network gọi `/api/v1/candles?...` đúng tham số.

### FE-M2 — Tin tức và thanh trạng thái
- **Tuần**: 5 · **Phụ trách**: D
- **Phụ thuộc**: FE-M1. **Mock**: Prism (`/news`, `/status`).

| Task | File | Mô tả | Công | Nhánh |
|---|---|---|---|---|
| FE-M2.1 | `src/components/NewsList.tsx` | 20 tin mới nhất theo symbol, mở link tab mới, thời gian tương đối | S | `feat/fe-news` |
| FE-M2.2 | `src/components/StatusBar.tsx` | "Cập nhật lần cuối" từ `/status`, badge đỏ khi `lag_seconds > 180` | S | `feat/fe-status-bar` |
| FE-M2.3 | `tests/` | Test badge trễ, danh sách rỗng | S | `feat/fe-status-bar` |

**Hoàn thành khi**: `npm test -- --run` xanh; sửa ví dụ mock `lag_seconds = 600` → badge cảnh báo hiển thị.

### FE-M3 — Chỉ báo và tín hiệu
- **Tuần**: 6 · **Phụ trách**: D
- **Phụ thuộc**: FE-M1. Sang repo khác: dữ liệu thật cần API-M3 (← INF-M5). **Mock**: Prism (`/indicators`, `/signals`).

| Task | File | Mô tả | Công | Nhánh |
|---|---|---|---|---|
| FE-M3.1 | `CandleChart.tsx`, `hooks.ts` | Line series MA20 (khung 5m) | S | `feat/fe-indicators` |
| FE-M3.2 | `CandleChart.tsx`, `SignalsPanel.tsx` | Marker tại nến có volume bất thường + danh sách tín hiệu | M | `feat/fe-signals` |
| FE-M3.3 | `tests/` | Ánh xạ tín hiệu → marker đúng thời điểm | S | `feat/fe-signals` |

**Hoàn thành khi**: test xanh; trên mock thấy đường MA20 và marker tại thời điểm của ví dụ `/signals`.

### FE-M4 — Nối API thật và hoàn thiện demo
- **Tuần**: 7 · **Phụ trách**: D
- **Phụ thuộc**: **API-M2, API-M3** (điểm tích hợp IP4 cuối tuần 6); INF-M6.1 (profile `app`).

| Task | File | Mô tả | Công | Nhánh |
|---|---|---|---|---|
| FE-M4.1 | `.env.example`, `src/api/client.ts` | `VITE_API_BASE_URL=http://localhost:8000/api/v1`; xử lý CORS/timeout | S | `feat/fe-real-api` |
| FE-M4.2 | `Dockerfile`, `nginx.conf` | Build tĩnh, nginx, port 80 (host 8088) | S | `feat/fe-docker` |
| FE-M4.3 | `src/` | Trạng thái lỗi kết nối API, nút thử lại; giao diện gọn cho trình chiếu | S | `feat/fe-real-api` |
| FE-M4.4 | `README.md`, ảnh chụp màn hình | Cách chạy dev/mock/thật | S | `docs/fe-usage` |

**Hoàn thành khi**:
```bash
docker compose -f ../infrastructure/docker-compose.yml --profile full up -d
# mở http://localhost:8088: nến BTCUSDT có nến mới mỗi phút, StatusBar lag < 180 s,
# DevTools Network chỉ có request tới http://localhost:8000/api/v1/*, không có :4010
```

## 5. Test và CI tối thiểu

- `.github/workflows/ci.yml` (mọi PR, Node 20): `npm ci` → `npm run lint` → `npm run typecheck` → `npm test -- --run` → `npm run build`.
- Kiểm tra `src/api/schema.d.ts` khớp `contracts/v1/openapi.yaml`: `npm run gen:api && git diff --exit-code src/api/schema.d.ts`.
- Tùy chọn tuần 7: Playwright smoke test 1 kịch bản (mở trang, thấy canvas biểu đồ) chạy với Prism.

## 6. Rủi ro riêng và giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| API thật đến muộn (tuần 6–7) | Prism mock từ hợp đồng; contract test phía API đảm bảo dữ liệu thật cùng định dạng |
| Lệch múi giờ (UTC vs giờ VN) trên biểu đồ | Chỉ chuyển đổi ở `lib/time.ts`, có test; trục thời gian hiển thị giờ VN, dữ liệu giữ UTC |
| D kiêm compose/CI/E2E (INF-M1, INF-M6) | FE-M0..M3 nhỏ (S/M); INF-M1 ở tuần 3 song song FE-M0; tuần 7–8 ưu tiên E2E, FE chỉ hoàn thiện |
| Biểu đồ giật khi refetch | Dùng `series.update()` cho nến cuối thay vì `setData` toàn bộ |

## 7. Vấn đề rà soát thuộc repo này

### Nghiêm trọng
| # | Vấn đề | Vị trí | Sửa ở |
|---|---|---|---|
| FE-C1 | Repo trống, chưa có dashboard — chặn tuần 7 của kế hoạch | toàn repo (chỉ `README.md` 0 byte) | FE-M0 → FE-M4 |

### Cao
| # | Vấn đề | Vị trí | Sửa ở |
|---|---|---|---|
| FE-H1 | Chưa có hợp đồng API để phát triển song song | — | INF-M0.2 + Prism (FE-M0) |
| FE-H2 | Chưa chốt stack | — | Q7 |

### Thấp
| # | Vấn đề | Vị trí | Sửa ở |
|---|---|---|---|
| L2 | `README.md` rỗng | `README.md` | FE-M4.4 |
| L3 | Không có CI | — | FE-M0.5 |
