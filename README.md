# KeyCore License Server v2

Server quản lý license/key tổng quát cho ứng dụng hợp pháp.

## Cài đặt
1. Cài Node.js LTS.
2. Mở terminal tại thư mục project.
3. `npm install`
4. Sao chép `.env.example` thành `.env` và đổi `ADMIN_PASSWORD`, `SESSION_SECRET`.
5. `npm start`
6. Mở `http://localhost:3000`.

## Tính năng
- Dashboard thống kê
- Tạo key đơn/lô
- 1 ngày đến 36500 ngày hoặc vĩnh viễn (0)
- Bind/reset HWID
- Ban/unban/disable
- Tìm kiếm và lọc
- Audit log
- API activate/validate
- SQLite local database

Nếu bạn đang nâng cấp từ v1, có thể giữ `licenses.db`; schema mới sẽ tự thêm bảng audit log.
