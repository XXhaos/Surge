/**
 * Xbox Cart Web Runner
 * 远程路径: https://raw.githubusercontent.com/dragonisheep/Surge/refs/heads/master/Scripts/NewAddToCart_Web.js
 *
 * 流程：
 * 1. GET 读取远程当前组（服务端加锁）
 * 2. 执行加购
 * 3. 加购完成后 GET clear（服务端释放锁 + 弹出该组）
 * 4. 若远程无数据，回退到本地 XboxProductList
 */

const MARKET = "NG";
const LOCALE = "en-ng";
const FRIENDLY_NAME = `cart-${MARKET}`;
const CLIENT_CONTEXT = { client: "UniversalWebStore.Cart", deviceType: "Pc" };

const REMOTE_READ_URL  = 'https://cc.dragonisheep.com/surge?token=xbox123';
const REMOTE_CLEAR_URL = 'https://cc.dragonisheep.com/surge?token=xbox123&action=clear';
const LOCAL_KEY        = 'XboxProductList';

const MUID  = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

let logBuffer = [];
const results = { success: [], failure: [] };
const successKeys = [];
let currentIndex = 0;
let productList = [];
let sourceLabel = "";
let useRemote = false;  // 是否使用了远程数据（决定加购后是否发 clear）

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

  // 清理本地 XboxProductList 中已成功的 key（仅本地模式）
  let remainingCount = 0;
  if (!useRemote) {
    try {
      let storeObj; try { storeObj = JSON.parse($persistentStore.read(LOCAL_KEY) || "{}"); } catch { storeObj = {}; }
      for (const k of successKeys) {
        if (k && Object.prototype.hasOwnProperty.call(storeObj, k)) delete storeObj[k];
      }
      remainingCount = Object.keys(storeObj).filter(k => /^product\d+$/.test(k)).length;
      $persistentStore.write(JSON.stringify(storeObj), LOCAL_KEY);
      log("info", "本地清理完成", `剩余: ${remainingCount}`);
    } catch (e) { log("error", "清理异常", String(e)); }
  }

  const doFinish = () => {
    $notification.post(
      "🛒 Xbox 加购完成",
      `成功: ${successCount} / 失败: ${failureCount}`,
      `来源: ${sourceLabel}${!useRemote ? ` | 剩余本地: ${remainingCount}` : ''}`
    );
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xbox Cart</title></head><body style="font-family:sans-serif;padding:20px;"><h3>执行结果: 成功 ${successCount} / 失败 ${failureCount} | 来源: ${sourceLabel}</h3><div style="background:#f9f9f9;padding:10px;">${logBuffer.join("")}</div></body></html>`;
    $done({ response: { status: 200, headers: { "Content-Type": "text/html;charset=utf-8" }, body: html } });
  };

  if (useRemote) {
    if (failureCount === 0) {
      // 全部成功：发 clear，释放服务端锁并弹出该组
      log("info", "加购全部成功，通知服务端 clear");
      $httpClient.get(REMOTE_CLEAR_URL, () => doFinish());
    } else {
      // 有失败：不 clear，保留服务端数据，下次可重试
      log("info", `有 ${failureCount} 个失败，保留服务端数据以便重试`);
      $notification.post("⚠️ 部分失败", `${failureCount} 个加购失败`, "服务端数据已保留，可重新执行");
      doFinish();
    }
  } else {
    doFinish();
  }
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
    // 远程模式下列表为空也要释放锁
    if (useRemote) {
      $httpClient.get(REMOTE_CLEAR_URL, () => $done({}));
    } else {
      finalizeAndClean();
    }
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
// ★ 服务端有锁机制，客户端不再需要时间锁
// 第一步：尝试从远程读取当前组（服务端此时会加锁）
$httpClient.get(REMOTE_READ_URL, (error, response, data) => {
  let remoteGroup = null;
  let groupIndex = null;

  if (!error && data) {
    try {
      const payload = JSON.parse((data || '').trim() || '{}');
      // 服务端有锁且有数据时返回 currentGroup
      if (payload.ok && payload.currentGroup) {
        const keys = Object.keys(payload.currentGroup);
        if (keys.length > 0) {
          remoteGroup = payload.currentGroup;
          groupIndex = payload.currentGroupIndex;
          log("info", "使用远程待同步 Product", `第 ${groupIndex} 组，共 ${keys.length} 个`);
        }
      }
    } catch (_) {}
  }

  if (remoteGroup) {
    useRemote = true;
    sourceLabel = `远程第 ${groupIndex} 组`;
    productList = parseProductList(JSON.stringify(remoteGroup));
    startTask();
  } else {
    // 远程无数据（队列为空或被锁）或连接失败，回退到本地
    useRemote = false;
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
