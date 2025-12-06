/**
 * ATC_Trigger.js
 * - 非阻塞触发：先 $done() 放行
 * - 异步拉取并执行你的 NewAddToCart.js（保持原样不改）
 * - 拦截 $notification.post：同步写入持久化日志，供 dump 页面展示
 */

try { $done({}); } catch (_) {}

(function () {
  const CORE_URL = "https://raw.githubusercontent.com/XXhaos/Surge/refs/heads/main/NewAddToCart.js"; // ← 你的原脚本
  const LOG_KEY  = "ATC_LOGS";
  const LAST_TS  = "ATC_LAST_TS";
  const LAST_MSG = "ATC_LAST_MSG";
  const MAX_KEEP = 100;

  // 去抖（30s 内只触发一次）— 可按需调整
  try {
    const K = "ATC_LastTrigger";
    const now = Date.now();
    const last = parseInt($persistentStore.read(K) || "0", 10);
    if (now - last < 30 * 1000) return;
    $persistentStore.write(String(now), K);
  } catch (_) {}

  // 工具：写日志
  function pushLog(title, subtitle, body) {
    const msg = [title, subtitle, body].filter(Boolean).join(" | ");
    try {
      const raw = $persistentStore.read(LOG_KEY) || "[]";
      const arr = JSON.parse(raw);
      arr.push({ ts: Date.now(), msg });
      while (arr.length > MAX_KEEP) arr.shift();
      $persistentStore.write(JSON.stringify(arr), LOG_KEY);
      $persistentStore.write(String(Date.now()), LAST_TS);
      $persistentStore.write(msg, LAST_MSG);
    } catch (_) {}
  }

  // Monkey-patch 通知
  const origNotify = ($notification && $notification.post) ? $notification.post.bind($notification) : null;
  if (origNotify) {
    $notification.post = function (title, subtitle, body) {
      pushLog(title, subtitle, body);
      try { return origNotify(title, subtitle, body); } catch (_) {}
    };
  }

  // 拉取并执行原脚本（屏蔽其内部 $done 以免二次结束报错）
  $httpClient.get({ url: CORE_URL }, (err, resp, body) => {
    if (err || !resp || resp.status !== 200 || !body) {
      pushLog("ATC Trigger", "拉取核心脚本失败", String(err || (resp && resp.status)));
      try { $notification.post("ATC Trigger", "拉取核心脚本失败", String(err || (resp && resp.status))); } catch (_){}
      return;
    }
    try {
      const bak = (typeof $done === "function") ? $done : null;
      if (bak) globalThis.$done = function () {};
      eval(body); // 执行你的 NewAddToCart.js（不修改）
      if (bak) globalThis.$done = bak;
    } catch (e) {
      pushLog("ATC Trigger", "执行核心脚本异常", String(e));
      try { $notification.post("ATC Trigger", "执行核心脚本异常", String(e)); } catch (_){}
    }
  });
})();
