/** Plain-text email for a new form submission or comment (Supabase Database Webhook payload, INSERT). */
const clip = (value, max = 4000) => String(value ?? '').slice(0, max);

export function buildNotification(payload, siteName = 'DeeDee Studio') {
  const record = payload?.record ?? {};
  if (payload?.type !== 'INSERT') return null;
  if (payload.table === 'form_submissions') {
    const fields = Array.isArray(record.fields) ? record.fields : [];
    const who = clip(record.name || record.email || record.phone || 'khách', 80);
    const lines = fields.map((field) => `${clip(field.label || field.key, 80)}: ${clip(field.value)}`);
    return {
      subject: `[${siteName}] Form mới: ${clip(record.form_label, 80)} — ${who}`,
      text: [`Có người vừa gửi form "${clip(record.form_label, 120)}" ở trang ${clip(record.page_path, 200)}.`, '', ...lines, '', 'Xem và đánh dấu đã xử lý trong CMS: mục "Form & bình luận".'].join('\n'),
    };
  }
  if (payload.table === 'comments') {
    return {
      subject: `[${siteName}] Bình luận mới chờ duyệt — ${clip(record.author_name, 60)}`,
      text: [`${clip(record.author_name, 80)} bình luận ở ${clip(record.post_path, 200)}:`, '', clip(record.body, 2000), '', 'Duyệt hoặc xóa trong CMS: mục "Form & bình luận".'].join('\n'),
    };
  }
  return null;
}

/** Constant-time comparison for the shared webhook secret. */
export function sameSecret(a, b) {
  const x = String(a ?? ''); const y = String(b ?? '');
  if (!y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
