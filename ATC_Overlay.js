/**
 * ATC_Overlay.js
 * - 仅处理 HTML（Content-Type 含 text/html）
 * - 从 $persistentStore 读取 ATC_LAST_MSG / ATC_LAST_TS
 * - 在页面右下角注入一个浮窗显示最近一次执行结果
 */
(function () {
  try {
    const hdrs = $response.headers || {};
    const ctype = (hdrs["Content-Type"] || hdrs["content-type"] || "").toLowerCase();
    if (!ctype.includes("text/html")) {
      $done({}); return;
    }

    const KEY_MSG = "ATC_LAST_MSG";
    const KEY_TS  = "ATC_LAST_TS";
    const msg = $persistentStore.read(KEY_MSG) || "尚无执行结果";
    const ts  = parseInt($persistentStore.read(KEY_TS) || "0", 10);
    const timeStr = ts ? new Date(ts).toLocaleString() : "";

    const panel = `
<div id="atc-overlay" style="position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:360px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="background:#111;color:#fff;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);overflow:hidden;">
    <div style="padding:10px 12px;font-weight:600;background:#1f6feb;">AddToCart 执行结果</div>
    <div style="padding:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word;">${escapeHtml(msg)}</div>
    <div style="padding:8px 12px;font-size:12px;color:#9ca3af;border-top:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(timeStr)}</span>
      <button onclick="document.getElementById('atc-overlay').remove()" style="background:#374151;color:#e5e7eb;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;">关闭</button>
    </div>
  </div>
</div>`;
    let html = $response.body || "";
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, panel + "</body>");
    } else {
      html += panel;
    }
    $done({ body: html });
  } catch (e) {
    $done({});
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }
})();
