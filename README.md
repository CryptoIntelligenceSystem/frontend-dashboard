# Crypto Intelligence Dashboard

Dashboard React + TypeScript đọc dữ liệu từ Backend API của dự án. Các phần gồm nến 1 phút / 5 phút, MA20 trên nến 1 phút, tín hiệu volume bất thường, tin tức CoinDesk, News Impact và trạng thái pipeline.

## Chạy cùng Docker Compose

Đặt `frontend-dashboard`, `backend-api`, `data-pipeline` và `infrastructure` cạnh nhau. Từ repo `infrastructure`:

```powershell
docker compose up -d --build frontend
```

Mở `http://localhost:3000`. Nginx phục vụ frontend và chuyển tiếp các yêu cầu `/api/` đến service `backend:5080`. Backend, ClickHouse và các dịch vụ liên quan được Compose khởi động theo `depends_on`. Để có dữ liệu mới, cần chạy collector và các Spark job theo README của `data-pipeline`.

## Chạy khi phát triển

Yêu cầu Node.js 22.12 trở lên. Khởi động Backend ở `http://localhost:5080`, sau đó chạy:

```powershell
npm ci
npm run dev
```

Mở `http://localhost:5173`. Vite chuyển tiếp `/api/` đến Backend. `npm run build` kiểm tra TypeScript và tạo bản phân phối trong `dist/`.

File `.env.example` ghi chú `VITE_API_BASE_URL` khi cần gọi Backend ở địa chỉ khác. Mặc định dùng đường dẫn `/api/` trên cùng host; không đưa mật khẩu ClickHouse hoặc khóa API vào biến môi trường frontend.

## Dữ liệu và bộ lọc

- Chọn `BTCUSDT` hoặc `ETHUSDT`; chọn nến 1 phút hoặc 5 phút.
- Khoảng thời gian trong bộ lọc dùng giờ máy của trình duyệt; yêu cầu API dùng UTC. Thời gian trên biểu đồ và danh sách được hiển thị theo GMT+7.
- Khi mở trang, Dashboard chọn khoảng 3 giờ quanh thời điểm dữ liệu gần nhất mà `/api/v1/status` báo. Các mốc tương lai xa (ví dụ hàng kiểm thử năm 2099) bị bỏ qua để không chọn nhầm phạm vi.
- API phân trang cho tin tức và News Impact. Biểu đồ yêu cầu tối đa 500 nến; hãy thu hẹp khoảng thời gian khi vượt giới hạn này.
- MA20 hiện tính trên nến 1 phút. Ở chế độ 5 phút, biểu đồ chỉ hiển thị nến 5 phút và khối lượng.
- News Impact so sánh biến động giá sau thời điểm bài viết, không khẳng định bài viết gây ra biến động.

Frontend không tự thu thập hay xử lý dữ liệu. Nếu ClickHouse chưa có hàng trong phạm vi chọn, phần tương ứng hiển thị trạng thái rỗng.
