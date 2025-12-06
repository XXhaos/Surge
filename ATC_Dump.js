/**
 * ATC_Dump.js
 * - http://addtocart.dump/       → 返回 HTML 页面（内嵌 JS 渲染日志）
 * - http://addtocart.dump/json   → 返回 JSON 日志
 * - http://addtocart.dump/clear  → 清空日志并返回提示
 */
(function () {
  const LOG_KEY  = "ATC_LOGS";

  const url = ($request && $request.url) || "";
  if (url.endsWith("/json")) {
    const raw = $persistentStore.read(LOG_KEY) || "[]";
    $done({
      status: "HTTP/1.1 200 OK",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: raw,
    });
    return;
  }

  if (url.endsWith("/clear")) {
    $persistentStore.write("[]", LOG_KEY);
    $done({
      status: "HTTP/1.1 200 OK",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "OK: logs cleared.",
    });
    return;
  }

  // HTML 页面
  const raw = $persistentStore.read(LOG_KEY) || "[]";
  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AddToCart Logs</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:16px;background:#0b1020;color:#e5e7eb}
h1{font-size:20px;margin:0 0 12px}
.card{background:#111827;border:1px solid #374151;border-radius:12px;padding:12px;margin:8px 0}
.row{display:flex;gap:8px;align-items:center;justify-content:space-between}
.time{color:#9ca3af;font-size:12px}
.msg{white-space:pre-wrap;word-break:break-word}
.btn{display:inline-block;padding:6px 10px;border-radius:8px;border:1px solid #4b5563;background:#1f2937;color:#e5e7eb;text-decoration:none}
.btn:hover{filter:brightness(1.1)}
.header{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:12px}
.empty{opacity:.6}
</style>
</head>
<body>
  <div class="header">
    <h1>AddToCart 执行日志</h1>
    <div>
      <a class="btn" href="/json">JSON</a>
      <a class="btn" href="/clear" onclick="return confirm('确认清空日志？')">清空</a>
      <a class="btn" href="/">刷新</a>
    </div>
  </div>
  <div id="list"></div>

<script>
(function(){
  const data = ${raw};
  const root = document.getElementById('list');
  if(!Array.isArray(data) || data.length===0){
    root.innerHTML = '<div class="card empty">尚无日志。</div>'; return;
  }
  root.innerHTML = data.slice().reverse().map(it=>{
    const t = new Date(it.ts||Date.now());
    const tt = t.toLocaleString();
    const m = (it.msg||'').replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]));
    return '<div class="card"><div class="row"><div class="time">'+tt+'</div></div><div class="msg">'+m+'</div></div>';
  }).join('');
})();
</script>
</body>
</html>`;
  $done({
    status: "HTTP/1.1 200 OK",
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: html,
  });
})();
