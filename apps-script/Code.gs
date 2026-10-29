/**
 * Nhận thông tin từ form trang /lien-he và /qua-tang của The Art of Corporate Gifting.
 * Ghi vào tab "Liên hệ doanh nghiệp" của Google Sheet và gửi email báo có liên hệ mới.
 *
 * Cài đặt (một lần):
 * 1. Mở script.google.com, Dự án mới, dán đè toàn bộ file này, Lưu.
 * 2. Sửa SHEET_ID thành ID của Google Sheet muốn ghi (đang để sheet của trang bán hàng, script tự tạo tab mới).
 * 3. Chạy tay hàm testNotify một lần để cấp quyền Sheet và Gmail.
 * 4. Triển khai > Triển khai mới > Ứng dụng web > Thực thi với tư cách: Tôi, Ai có quyền truy cập: Bất kỳ ai > Triển khai.
 * 5. Copy URL ứng dụng web (đuôi /exec) dán vào LEAD_ENDPOINT trong lien-he/index.html.
 * Cập nhật mã sau này: dán đè, Lưu, Triển khai > Quản lý triển khai > bút chì > Phiên bản mới > Triển khai. URL giữ nguyên.
 */

const SHEET_ID = '1Lba9W2gbDLvjUg7R_8_SoGlZSV_BnLzFdM1lw4WP23o';
const LEADS_TAB = 'Liên hệ doanh nghiệp';
const NOTIFY_TO = 'givehada@h2yjsc.com';
const HEADERS = ['Thời gian', 'Họ và tên', 'Chức vụ', 'Tên doanh nghiệp', 'Số điện thoại', 'Email', 'Quà tặng quan tâm', 'Số lượng dự kiến', 'Ghi chú', 'Trang', 'Nguồn', 'Trạng thái'];

function doGet() {
  return json_({ ok: true, service: 'corporate-gifting-leads' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, message: 'Dữ liệu không hợp lệ.' });
  }

  // Ô ẩn chống máy dò: báo thành công nhưng không ghi gì.
  if (data.website) return json_({ ok: true });

  const name = clean_(data.name, 80);
  const title = clean_(data.title, 80);
  const company = clean_(data.company, 120);
  const phone = normPhone_(data.phone);
  const email = clean_(data.email, 120).toLowerCase();
  const gifts = (Array.isArray(data.gifts) ? data.gifts : []).map(function (g) { return clean_(g, 60); }).filter(String).slice(0, 10).join(', ');
  const qty = clean_(data.qty, 12);
  const note = clean_(data.note, 300);
  if (name.length < 2) return json_({ ok: false, message: 'Vui lòng nhập họ và tên.' });
  if (company.length < 2) return json_({ ok: false, message: 'Vui lòng nhập tên doanh nghiệp.' });
  if (!/^0\d{9,10}$/.test(phone)) return json_({ ok: false, message: 'Số điện thoại chưa đúng.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, message: 'Email chưa đúng.' });

  // Tối đa 5 lượt gửi mỗi 30 phút cho một số điện thoại.
  const cache = CacheService.getScriptCache();
  const rateKey = 'lead_' + phone;
  const hits = Number(cache.get(rateKey) || 0);
  if (hits >= 5) return json_({ ok: true, throttled: true });
  cache.put(rateKey, String(hits + 1), 1800);

  const src = data.source || {};
  const srcText = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'referrer']
    .filter(function (k) { return src[k]; })
    .map(function (k) { return k + '=' + clean_(src[k], 200); })
    .join('\n');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    sh.appendRow([new Date(), name, title, company, "'" + phone, email, gifts, qty, note, clean_(data.page, 300), srcText, 'Mới']);
  } finally {
    lock.releaseLock();
  }

  try {
    notify_({ name: name, title: title, company: company, phone: phone, email: email, gifts: gifts, qty: qty, note: note, srcText: srcText });
  } catch (err) {
    console.error('Gửi email báo liên hệ lỗi: ' + err);
  }
  return json_({ ok: true });
}

/* ---------- tiện ích ---------- */

function sheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(LEADS_TAB);
  if (!sh) {
    sh = ss.insertSheet(LEADS_TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function notify_(o) {
  const row = function (k, v) { return v ? '<tr><td style="padding:5px 10px;color:#777">' + k + '</td><td style="padding:5px 10px"><b>' + esc_(v) + '</b></td></tr>' : ''; };
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
    + '<h2 style="margin:0 0 6px">Liên hệ mới từ The Art of Corporate Gifting</h2>'
    + '<p style="margin:0 0 14px;color:#555">Khách doanh nghiệp để lại thông tin, liên hệ trong giờ làm việc.</p>'
    + '<table style="border-collapse:collapse">' + row('Họ và tên', o.name) + row('Chức vụ', o.title) + row('Doanh nghiệp', o.company)
    + row('Số điện thoại', o.phone) + row('Email', o.email) + row('Quà tặng quan tâm', o.gifts) + row('Số lượng dự kiến', o.qty) + row('Ghi chú', o.note) + '</table>'
    + (o.srcText ? '<p style="color:#777;font-size:12px;white-space:pre-line">Nguồn: ' + esc_(o.srcText) + '</p>' : '')
    + '<p><a href="https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit">Mở bảng liên hệ</a></p></div>';
  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: '[Corporate Gifting] ' + o.name + ' | ' + o.company + ' | ' + o.phone,
    htmlBody: html,
    name: 'The Art of Corporate Gifting',
  });
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/^[=+\-@]+/, '').trim().slice(0, max);
}

function normPhone_(v) {
  let s = String(v || '').trim().replace(/[^\d+]/g, '');
  if (s.indexOf('+84') === 0) s = '0' + s.slice(3);
  else if (s.indexOf('84') === 0 && s.length === 11) s = '0' + s.slice(2);
  return s.replace(/\D/g, '');
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Chạy tay một lần trong trình soạn Apps Script để cấp quyền và thử ghi, gửi email. */
function testNotify() {
  sheet_();
  notify_({ name: 'Khách thử', title: 'Giám đốc', company: 'Công ty thử nghiệm', phone: '0912345678', email: 'test@example.com', gifts: 'The Ritual Case', qty: '50', note: 'Thử nghiệm', srcText: '' });
}
