# Email báo khi có form hoặc bình luận mới

## Trạng thái (27/10/2026)
Đã làm trên project Supabase `deedee-forms`:
- Hàm Edge `notify-submission` đã triển khai (mã trong `supabase/functions/notify-submission/`, bản một file: `bundle.ts`).
- 2 Database Webhook (`notify_form_submissions`, `notify_comments`, sự kiện Insert) gọi hàm đó.
- Secret `NOTIFY_TO` = `avalook.dev@gmail.com`, `NOTIFY_FROM` = `DeeDee Studio <onboarding@resend.dev>`.
- Đã thử: gửi một dòng form thử → webhook gọi hàm → hàm tìm thấy dòng trong cơ sở dữ liệu và gọi Resend (lỗi 502 vì **chưa có khóa Resend**). Dòng thử đã xóa.

**Còn thiếu đúng một thứ: secret `RESEND_API_KEY`.**
1. Đăng ký resend.com bằng `avalook.dev@gmail.com` (địa chỉ gửi thử `onboarding@resend.dev` chỉ gửi được tới đúng email chủ tài khoản), vào API Keys → tạo key (bắt đầu bằng `re_`).
2. Supabase → Edge Functions → **Secrets** (`/dashboard/project/eyecmmwnvlhubzvijktf/functions/secrets`) → Name `RESEND_API_KEY`, Value là key → Save.
3. Gửi thử một form trên web: mail đến trong vài giây (xem Invocations của hàm nếu không thấy).

Hàm không cần mã bí mật trong webhook: nó chỉ nhận "bảng + mã dòng" rồi tự tra dòng đó trong cơ sở dữ liệu (bằng khóa dịch vụ có sẵn trong Edge Functions) và chỉ gửi mail nếu dòng có thật và mới tạo trong 5 phút; nội dung mail lấy từ dòng trong cơ sở dữ liệu, không lấy từ yêu cầu gửi tới. Mã dòng là UUID ngẫu nhiên mà khách không đọc được. Xác thực JWT của hàm vẫn bật (webhook tự gắn khóa công khai của dự án).

Muốn gửi từ `@deedeestudio.net` hoặc tới nhiều người: xác minh tên miền trên resend.com/domains (bản ghi DNS), rồi đổi `NOTIFY_FROM` và `NOTIFY_TO` (nhiều email cách nhau bằng dấu phẩy) trong trang Secrets.

---
Phần dưới là cách làm bằng CLI (thay thế, nếu cần triển khai lại).

## Cách nhanh (nhận mail ở Gmail, không cần tên miền)
Địa chỉ gửi thử của Resend (`onboarding@resend.dev`) **chỉ gửi được tới email của chính tài khoản Resend**. Nên đăng ký Resend bằng đúng email muốn nhận (ví dụ `avalook.dev@gmail.com`) là dùng được ngay.
1. Đăng ký tại resend.com bằng email đó, vào API Keys → tạo key (bắt đầu bằng `re_`).
2. Cài Supabase CLI, chạy `supabase login`, rồi trong thư mục repo:
   ```bash
   bash supabase/setup-notify.sh
   ```
   Script hỏi email nhận và khóa Resend (gõ ẩn), tự đặt secret và triển khai hàm.
3. Hai webhook đã có sẵn (xem mục Trạng thái), không cần tạo lại.
4. Gửi thử một form trên web: mail đến trong vài giây.
Muốn gửi từ `@deedeestudio.net` hoặc tới nhiều người: xác minh tên miền trên resend.com/domains (thêm bản ghi DNS), rồi chạy lại script với `NOTIFY_FROM="DeeDee <noreply@deedeestudio.net>"` và nhập nhiều email cách nhau bằng dấu phẩy.

## Cách làm từng bước (thủ công)
1. Tạo tài khoản Resend (resend.com), xác minh tên miền gửi mail, tạo API key.
2. Cài Supabase CLI và đăng nhập (`supabase login`), rồi trong thư mục repo:
   ```bash
   supabase secrets set --project-ref eyecmmwnvlhubzvijktf WEBHOOK_SECRET=<chuỗi-ngẫu-nhiên-dài> RESEND_API_KEY=<khóa-resend> NOTIFY_FROM="DeeDee <noreply@tên-miền-của-bạn>" NOTIFY_TO="contact@deedeestudio.net"
   supabase functions deploy notify-submission --project-ref eyecmmwnvlhubzvijktf --no-verify-jwt
   ```
3. Supabase Dashboard → Database → Webhooks → tạo 2 webhook (bảng `form_submissions` và bảng `comments`, sự kiện **Insert**), loại HTTP Request tới `https://eyecmmwnvlhubzvijktf.supabase.co/functions/v1/notify-submission`, thêm header `x-webhook-secret` bằng đúng `WEBHOOK_SECRET`.
4. Gửi thử một form trên web: email đến hộp `NOTIFY_TO`.

Không đưa `RESEND_API_KEY` hay `WEBHOOK_SECRET` vào repo. Function từ chối mọi yêu cầu thiếu hoặc sai secret.
