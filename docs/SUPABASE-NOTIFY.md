# Email báo khi có form hoặc bình luận mới

Supabase không tự gửi mail. Cách làm: Database Webhook → Edge Function `notify-submission` → dịch vụ gửi mail (ví dụ Resend). Code đã có sẵn trong `supabase/functions/notify-submission/`; **chưa được triển khai** vì cần tài khoản và khóa của bạn.

## Cách nhanh (nhận mail ở Gmail, không cần tên miền)
Địa chỉ gửi thử của Resend (`onboarding@resend.dev`) **chỉ gửi được tới email của chính tài khoản Resend**. Nên đăng ký Resend bằng đúng email muốn nhận (ví dụ `avalook.dev@gmail.com`) là dùng được ngay.
1. Đăng ký tại resend.com bằng email đó, vào API Keys → tạo key (bắt đầu bằng `re_`).
2. Cài Supabase CLI, chạy `supabase login`, rồi trong thư mục repo:
   ```bash
   bash supabase/setup-notify.sh
   ```
   Script hỏi email nhận và khóa Resend (gõ ẩn), tự đặt secret, triển khai hàm, rồi in ra giá trị `x-webhook-secret` **một lần**.
3. Supabase Dashboard → Database → Webhooks: tạo 2 webhook (bảng `form_submissions` và `comments`, sự kiện Insert) theo đúng hướng dẫn script in ra.
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
