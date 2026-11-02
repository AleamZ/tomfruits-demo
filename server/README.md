# Server đồng bộ KiotViet

Đồng bộ **sản phẩm, danh mục, chi nhánh và tồn kho theo chi nhánh** từ KiotViet về cho màn Hàng hóa.
Chỉ đọc từ KiotViet, không ghi ngược. Không cần cài thêm thư viện (Node 22+).

Cách kết nối lấy theo repo `ChickenAI/n8n-nodes-kiotviet`, có sửa:
- chỉ xóa webhook trùng URL của mình (repo gốc xóa cả webhook của ứng dụng khác)
- kiểm tra chữ ký trên body gốc
- thử lại khi gặp lỗi 429 (vượt giới hạn gọi API)

## Chạy

1. Copy `server/.env.example` thành `server/.env`, điền `KIOTVIET_RETAILER`, `KIOTVIET_CLIENT_ID`, `KIOTVIET_CLIENT_SECRET`
   (KiotViet → Thiết lập → Thiết lập kết nối API).
2. `node server/index.mjs` — lần đầu đồng bộ toàn bộ, sau đó cứ `SYNC_INTERVAL_MINUTES` phút đồng bộ phần thay đổi.
3. Giao diện: `.env.local` đã bật `VITE_APP_KIOTVIET=true`, chạy `npm run dev`. Màn Hàng hóa có nút **Đồng bộ KiotViet**.
   localhost cổng nào cũng gọi được; khi chạy thật thì đặt `CORS_ORIGIN` là domain giao diện.

Dữ liệu lưu ở `server/data/kiotviet.json` (đã gitignore).

## API

| Đường dẫn | Việc |
|---|---|
| `GET /products?page&limit&keyword&categoryId&branchId` | Danh sách sản phẩm (dạng `ProductData`), `stock` = tổng tồn, hoặc tồn của `branchId` |
| `GET /products/:id` | Chi tiết, kèm `inventories` từng chi nhánh |
| `GET /categories` | Danh mục KiotViet |
| `GET /kiotviet/status` | Lần đồng bộ cuối, số sản phẩm, chi nhánh, nhật ký |
| `POST /kiotviet/sync` (`?full=true` để đồng bộ lại toàn bộ) | Đồng bộ ngay |
| `POST /kiotviet/webhooks/register` body `{"url":"https://<domain>/kiotviet/webhook"}` | Đăng ký webhook `product.update`, `product.delete`, `stock.update` |
| `POST /kiotviet/webhook` | Nơi KiotViet gửi webhook (tồn kho / sản phẩm cập nhật tức thì) |

## Webhook (cập nhật tức thì)

KiotViet chỉ gọi được địa chỉ **public HTTPS**. Khi chạy local, dùng tunnel (ngrok, cloudflared) rồi gọi
`/kiotviet/webhooks/register` với URL đó. Cần đặt `KIOTVIET_WEBHOOK_SECRET`.
Chưa có webhook thì vẫn có đồng bộ định kỳ.

Chưa kiểm chứng: định dạng chữ ký `X-Hub-Signature` thật của KiotViet. Server chấp nhận sha1/sha256 (hex/base64).
Nếu nhật ký báo "Sai chữ ký webhook", xem giá trị header trong log để chỉnh lại.
