/**
 * ATC_Trigger.js
 * - 访问 add_to_cart.com 即触发
 * - 立即 $done 放行请求，不阻塞
 * - 异步拉取并执行你的 NewAddToCart.js
 * - Monkey-patch $notification.post，把通知同步写入 $persistentStore 以便网页浮窗展示
 */

try { $done({}); } catch (_) {}

(function main() {
  const CORE_URL = "https://raw.githubusercontent.com/XXhaos/Surge/refs/heads/main/NewAddToCart.js";
  const KEY_MSG  = "ATC_LAST_MSG";
  const KEY_TS   = "ATC_LAST_TS";

  // 去抖：30 秒内只触发一次（可按需调整/删掉）
  try {
    const K = "ATC_LastTrigger";
    const now = Date.now();
    const last = parseInt($persistentStore.read(K) || "0", 10);
    if (now - last < 30 * 1000) return;
    $persistentStore.write(String(now), K);
  } catch (_) {}

  // 拦截通知：写入持久化
  const origNotify = ($notification && $notification.post) ? $notification.post.bind($notification) : null;
  function saveMessage(title, subtitle, body) {
    const msg = [title, subtitle, body].filter(Boolean).join(" | ");
    try {
      $persistentStore.write(msg, KEY_MSG);
      $persistentStore.write(String(Date.now()), KEY_TS);
    } catch (_) {}
  }
  if (origNotify) {
    $notification.post = function(title, subtitle, body) {
      saveMessage(title, subtitle, body);
      try { return origNotify(title, subtitle, body); } catch (_) {}
    };
  }

  // 拉取并执行原脚本（禁用其内部 $done 以免报错）
  $httpClient.get({ url: CORE_URL }, (err, resp, body) => {
    if (err || !resp || resp.status !== 200 || !body) {
      saveMessage("AddToCart 触发器", "拉取核心脚本失败", String(err || (resp && resp.status)));
      try { $notification.post("AddToCart 触发器", "拉取核心脚本失败", String(err || (resp && resp.status))); } catch (_){}
      return;
    }
    try {
      const bakDone = (typeof $done === "function") ? $done : null;
      if (bakDone) globalThis.$done = function(){};  // 防止核心脚本再次 $done
      eval(body);                                     // 执行你的 NewAddToCart.js
      if (bakDone) globalThis.$done = bakDone;
    } catch (e) {
      saveMessage("AddToCart 触发器", "执行核心脚本异常", String(e));
      try { $notification.post("AddToCart 触发器", "执行核心脚本异常", String(e)); } catch (_){}
    }
  });
})();
