// 先放行，防阻塞
try { $done({}); } catch (_) {}

const CORE_URL = "https://raw.githubusercontent.com/XXhaos/Surge/refs/heads/main/NewAddToCart.js";

// 可选去抖：30秒内只触发一次
try {
  const K = 'AddToCart_LastTrigger', now = Date.now();
  const last = parseInt($persistentStore.read(K) || '0', 10);
  if (now - last < 30 * 1000) return;
  $persistentStore.write(String(now), K);
} catch (_) {}

$httpClient.get({ url: CORE_URL }, (err, resp, body) => {
  if (err || !resp || resp.status !== 200 || !body) {
    try { $notification.post("AddToCart 触发器", "拉取核心脚本失败", String(err || (resp && resp.status))); } catch (_){}
    return;
  }
  try {
    const bak = (typeof $done === "function") ? $done : null;
    if (bak) globalThis.$done = function(){}; // 防止核心脚本内部再 $done 冲突
    eval(body);                                // 执行你的原始 NewAddToCart.js（保持不变）
    if (bak) globalThis.$done = bak;
  } catch (e) {
    try { $notification.post("AddToCart 触发器", "执行核心脚本异常", String(e)); } catch (_){}
  }
});
