/**
 * Xbox Cart Web Runner
 * 远程路径: https://raw.githubusercontent.com/XXhaos/Surge/refs/heads/main/NewAddToCart_Web.js
 */

const MARKET = "NG";
const LOCALE = "en-ng";
const FRIENDLY_NAME = `cart-${MARKET}`;
const CLIENT_CONTEXT = { client: "UniversalWebStore.Cart", deviceType: "Pc" };

// 读取配置
const LIST_RAW = $persistentStore.read("XboxProductList") || "{}";
const MUID = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

// 日志缓存
let logBuffer = [];
const results = { success: [], failure: [] };
const successKeys = [];
let currentIndex = 0;

function log(type, message, detail = "") {
  const icon = type === "success" ? "✅" : (type === "error" ? "❌" : "ℹ️");
  const color = type === "success" ? "green" : (type === "error" ? "red" : "#666");
  console.log(`${icon} ${message} ${detail}`);
  logBuffer.push(`<div style="color:${color}; border-bottom:1px solid #eee; padding:5px;">${icon} ${message} <small>${detail}</small></div>`);
}

const generateRiskSessionId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => (c === "x" ? (Math.random() * 16 | 0) : ((Math.random() * 4 | 8) | 0)).toString(16));

const toNum = k => { const m = /^product(\d+)$/.exec(k); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; };
const normEntry = v => {
  if (!v || typeof v !== "object") return null;
  const productId = String(v.ProductId ?? v.productId ?? "").trim();
  const skuId = String(v.SkuId ?? v.skuId ?? "").trim();
  const availabilityId = String(v.AvailabilityId ?? v.availabilityId ?? "").trim();
  if (!productId || !skuId || !availabilityId) return null;
  return { productId, skuId, availabilityId };
};

let parsed; try { parsed = JSON.parse(LIST_RAW); } catch { parsed = {}; }
const productList = Object.keys(parsed).filter(k => /^product\d+$/.test(k)).sort((a,b) => toNum(a) - toNum(b)).map(k => { const norm = normEntry(parsed[k]); return norm ? { key: k, ...norm } : null; }).filter(Boolean);

const API_URL = "https://cart.production.store-web.dynamics.com/cart/v1.0/cart/loadCart?cartType=consumer&appId=StoreWeb";
const HEADERS = { "content-type": "application/json", "accept": "*/*", "x-authorization-muid": MUID, "ms-cv": MS_CV, "origin": "https://www.microsoft.com", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" };

function finalizeAndClean() {
  const successCount = results.success.length;
  const failureCount = results.failure.length;
  let remainingCount = 0;
  
  try {
    let storeObj; try { storeObj = JSON.parse($persistentStore.read("XboxProductList") || "{}"); } catch { storeObj = {}; }
    for (const k of successKeys) if (k && Object.prototype.hasOwnProperty.call(storeObj, k)) delete storeObj[k];
    remainingCount = Object.keys(storeObj).filter(k => /^product\d+$/.test(k)).length;
    $persistentStore.write(JSON.stringify(storeObj), "XboxProductList");
    log("info", "清理完成", `剩余: ${remainingCount}`);
  } catch (e) { log("error", "清理异常", e); }

  // 【新增】发送系统通知
  $notification.post(
    "🛒 Xbox 加购完成",
    `成功: ${successCount} / 失败: ${failureCount}`,
    `剩余库存: ${remainingCount}`
  );

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xbox Cart</title></head><body style="font-family:sans-serif;padding:20px;"><h3>执行结果: 成功 ${successCount} / 剩余 ${remainingCount}</h3><div style="background:#f9f9f9;padding:10px;">${logBuffer.join("")}</div></body></html>`;
  
  $done({ response: { status: 200, headers: { "Content-Type": "text/html;charset=utf-8" }, body: html } });
}

function sendRequest() {
  if (currentIndex >= productList.length) return finalizeAndClean();
  const { key, productId, skuId, availabilityId } = productList[currentIndex];
  const bodyObj = { locale: LOCALE, market: MARKET, catalogClientType: "storeWeb", friendlyName: FRIENDLY_NAME, riskSessionId: generateRiskSessionId(), clientContext: CLIENT_CONTEXT, itemsToAdd: { items: [{ productId, skuId, availabilityId, campaignId: "xboxcomct", quantity: 1 }] } };

  $httpClient.put({ url: API_URL, headers: HEADERS, body: JSON.stringify(bodyObj) }, (error, response) => {
    const idStr = `${productId}`;
    if (error || response.status !== 200) {
      results.failure.push(idStr); log("error", "失败", idStr);
    } else {
      results.success.push(idStr); if (key) successKeys.push(key); log("success", "成功", idStr);
    }
    currentIndex++; setTimeout(sendRequest, 50);
  });
}

if (!MUID || !MS_CV) { 
    log("error", "缺少 MUID/CV"); 
    // 即使配置错误也发个通知提醒你
    $notification.post("❌ Xbox 脚本错误", "缺少必要参数", "请检查 MUID 或 MS_CV");
    finalizeAndClean(); 
}
else if (productList.length === 0) { 
    log("info", "列表为空"); 
    $notification.post("⚠️ Xbox 脚本", "无需执行", "列表为空");
    finalizeAndClean(); 
}
else { 
    log("info", "开始任务", `数量: ${productList.length}`); 
    sendRequest(); 
}
