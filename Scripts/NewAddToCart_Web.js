/**
 * Xbox Cart Web Runner
 * 远程路径: https://raw.githubusercontent.com/dragonisheep/Surge/refs/heads/master/Scripts/NewAddToCart_Web.js
 *
 * 优先级：
 * 1. 远程待同步 Product（fetch_and_clear，单次只取一组）
 * 2. 本地 XboxProductList（兜底）
 */

const MARKET = "NG";
const LOCALE = "en-ng";
const FRIENDLY_NAME = `cart-${MARKET}`;
const CLIENT_CONTEXT = { client: "UniversalWebStore.Cart", deviceType: "Pc" };

const REMOTE_URL  = 'https://cc.dragonisheep.com/surge?token=xbox123&action=fetch_and_clear';
const LOCAL_KEY   = 'XboxProductList';
const LOCK_KEY    = 'SyncXboxLock';

const MUID  = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

let logBuffer = [];
const results = { success: [], failure: [] };
const successKeys = [];
let currentIndex = 0;
let productList = [];
let sourceLabel = "";  // 记录数据来源，用于最终通知

function log(type, message, detail = "") {
  const icon  = type === "success" ? "✅" : (type === "error" ? "❌" : "ℹ️");
  const color = type === "success" ? "green" : (type === "error" ? "red" : "#666");
  console.log(`${icon} ${message} ${detail}`);
  logBuffer.push(`<div style="color:${color}; border-bottom:1px solid #eee; padding:5px;">${icon} ${message} <small>${detail}</small></div>`);
}

const generateRiskSessionId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c =>
    (c === "x" ? (Math.random() * 16 | 0) : ((Math.random() * 4 | 8) | 0)).toString(16));

const toNum = k => { const m = /^product(\d+)$/.exec(k); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; };
const normEntry = v => {
  if (!v || typeof v !== "object") return null;
  const productId      = String(v.ProductId      ?? v.productId      ?? "").trim();
  const skuId          = String(v.SkuId          ?? v.skuId          ?? "").trim();
  const availabilityId = String(v.AvailabilityId ?? v.availabilityId ?? "").trim();
  if (!productId || !skuId || !availabilityId) return null;
  return { productId, skuId, availabilityId };
};

function parseProductList(raw) {
  let parsed; try { parsed = JSON.parse(raw || "{}"); } catch { parsed = {}; }
  return Object.keys(parsed)
    .filter(k => /^product\d+$/.test(k))
    .sort((a, b) => toNum(a) - toNum(b))
    .map(k => { const norm = normEntry(parsed[k]); return norm ? { key: k, ...norm } : null; })
    .filter(Boolean);
}

const API_URL = "https://cart.production.store-web.dynamics.com/cart/v1.0/cart/loadCart?cartType=consumer&appId=StoreWeb";
const HEADERS = {
  "content-type": "application/json",
  "accept": "*/*",
  "x-authorization-muid": MUID,
  "ms-cv": MS_CV,
  "origin": "https://www.microsoft.com",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
};

function finalizeAndClean() {
  const successCount = results.success.length;
  const failureCount = results.failure.length;
  let remainingCount = 0;

  try {
    // 只清理本地 XboxProductList 中已成功的 key
    let storeObj; try { storeObj = JSON.parse($persistentStore.read(LOCAL_KEY) || "{}"); } catch { storeObj = {}; }
    for (const k of successKeys) {
      if (k && Object.prototype.hasOwnProperty.call(storeObj, k)) delete storeObj[k];
    }
    remainingCount = Object.keys(storeObj).filter(k => /^product\d+$/.test(k)).length;
    $persistentStore.write(JSON.stringify(storeObj), LOCAL_KEY);
    log("info", "清理完成", `剩余: ${remainingCount}`);
  } catch (e) { log("error", "清理异常", e); }

  $notification.post(
    "🛒 Xbox 加购完成",
    `成功: ${successCount} / 失败: ${failureCount}`,
    `来源: ${sourceLabel} | 剩余本地: ${remainingCount}`
  );

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xbox Cart</title></head><body style="font-family:sans-serif;padding:20px;"><h3>执行结果: 成功 ${successCount} / 失败 ${failureCount} | 来源: ${sourceLabel}</h3><div style="background:#f9f9f9;padding:10px;">${logBuffer.join("")}</div></body></html>`;
  $done({ response: { status: 200, headers: { "Content-Type": "text/html;charset=utf-8" }, body: html } });
}

function startTask() {
  if (!MUID || !MS_CV) {
    log("error", "缺少 MUID/CV");
    $notification.post("❌ Xbox 脚本错误", "缺少必要参数", "请检查 MUID 或 MS_CV");
    finalizeAndClean();
    return;
  }
  if (productList.length === 0) {
    log("info", "列表为空");
    $notification.post("⚠️ Xbox 脚本", "无需执行", `来源: ${sourceLabel} | 列表为空`);
    finalizeAndClean();
    return;
  }
  log("info", `开始任务 [${sourceLabel}]`, `数量: ${productList.length}`);
  sendRequest();
}

function sendRequest() {
  if (currentIndex >= productList.length) return finalizeAndClean();
  const { key, productId, skuId, availabilityId } = productList[currentIndex];
  const bodyObj = {
    locale: LOCALE, market: MARKET,
    catalogClientType: "storeWeb",
    friendlyName: FRIENDLY_NAME,
    riskSessionId: generateRiskSessionId(),
    clientContext: CLIENT_CONTEXT,
    itemsToAdd: { items: [{ productId, skuId, availabilityId, campaignId: "xboxcomct", quantity: 1 }] }
  };

  $httpClient.put({ url: API_URL, headers: HEADERS, body: JSON.stringify(bodyObj) }, (error, response) => {
    const idStr = `${productId}`;
    if (error || response.status !== 200) {
      results.failure.push(idStr);
      log("error", "失败", idStr);
    } else {
      results.success.push(idStr);
      if (key) successKeys.push(key);
      log("success", "成功", idStr);
    }
    currentIndex++;
    setTimeout(sendRequest, 50);
  });
}

// ========================= 主流程 =========================
// 防重入锁（和 SyncXboxCloud.js 共用同一个 lockKey）
const lockVal = $persistentStore.read(LOCK_KEY);
if (lockVal && Date.now() - parseInt(lockVal, 10) < 5000) {
  // 5 秒内重复触发，直接放行
  $done({});
}
$persistentStore.write(String(Date.now()), LOCK_KEY);

// 第一步：尝试从远程取一组待同步 Product
$httpClient.get(REMOTE_URL, (error, response, data) => {
  let remoteGroup = null;

  if (!error && data) {
    try {
      const payload = JSON.parse((data || '').trim() || '{}');
      if (payload.ok && payload.cleared && payload.currentGroup) {
        const keys = Object.keys(payload.currentGroup);
        if (keys.length > 0) {
          remoteGroup = payload.currentGroup;
          log("info", "使用远程待同步 Product", `第 ${payload.currentGroupIndex} 组，共 ${keys.length} 个`);
        }
      }
    } catch (_) {}
  }

  if (remoteGroup) {
    // 使用远程数据，不写入本地 XboxProductList（已由服务端 fetch_and_clear 删除）
    sourceLabel = "远程同步";
    productList = parseProductList(JSON.stringify(remoteGroup));
    startTask();
  } else {
    // 远程无数据或连接失败，回退到本地
    const localRaw = $persistentStore.read(LOCAL_KEY) || "{}";
    sourceLabel = "本地";
    productList = parseProductList(localRaw);
    if (!error) {
      log("info", "远程队列为空，使用本地 Product");
    } else {
      log("info", "远程连接失败，使用本地 Product", String(error));
    }
    startTask();
  }
});
