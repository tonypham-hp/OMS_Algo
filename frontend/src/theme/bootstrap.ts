// Script khởi động theme, chèn nội tuyến vào <head> của index.html (plugin trong vite.config.ts) để đặt data-theme
// TRƯỚC lần vẽ đầu: tải lại trang không nháy sai theme. Logic giống resolveAppearance (src/theme/appearance.ts);
// test chạy chính chuỗi này và so kết quả. Viết ES5 thuần, không import, mọi lỗi đều rơi về mặc định Tối.

export const BOOTSTRAP_SCRIPT = `(function () {
  var root = document.documentElement;
  var s = {};
  try {
    var raw = window.localStorage.getItem('oms-appearance:last');
    if (raw) s = JSON.parse(raw) || {};
  } catch (e) {
    s = {};
  }
  function mq(q) {
    try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; }
  }
  var mode = s.mode === 'light' || s.mode === 'dark' || s.mode === 'system' ? s.mode : 'dark';
  var base = mode === 'system' ? (mq('(prefers-color-scheme: dark)') ? 'dark' : 'light') : mode;
  var hc = s.highContrast === true || s.highContrast === false ? s.highContrast : mq('(prefers-contrast: more)');
  root.setAttribute('data-theme', hc ? (base === 'dark' ? 'hc-dark' : 'hc-light') : base);
  root.setAttribute('data-palette', s.palette === 'cvd' ? 'cvd' : 'default');
  root.setAttribute('data-density', s.density === 'compact' ? 'compact' : 'comfortable');
  root.setAttribute('data-font-scale', s.fontScale === 90 || s.fontScale === 110 ? String(s.fontScale) : '100');
  root.setAttribute('data-flash', s.flash === false ? 'off' : 'on');
  if (mq('(forced-colors: active)')) root.setAttribute('data-forced-colors', 'active');
  root.style.colorScheme = base;
})();`

/** Chèn script vào index.html tại chỗ đánh dấu <!-- theme-bootstrap -->. */
export function injectBootstrap(html: string): string {
  return html.replace('<!-- theme-bootstrap -->', `<script>${BOOTSTRAP_SCRIPT}</script>`)
}
