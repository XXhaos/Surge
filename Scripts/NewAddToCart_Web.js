/**
 * Xbox Cart Web Runner
 * 远程路径: https://raw.githubusercontent.com/dragonisheep/Surge/refs/heads/master/Scripts/NewAddToCart_Web.js
 *
 * 流程：
 * 1. GET 读取远程当前组（服务端加锁）
 * 2. 执行加购
 * 3. POST /surge/commit 提交结果：
 *    - remaining 为空 → 服务端弹出当前组（全部成功）
 *    - remaining 非空 → 服务端用失败的 product 更新当前组，释放锁（部分失败，下次只重试失败部分）
 * 4. 若远程无数据，回退到本地 XboxProductList
 */

const MARKET = "NG";
const LOCALE = "en-ng";
const FRIENDLY_NAME = `cart-${MARKET}`;
const CLIENT_CONTEXT = { client: "UniversalWebStore.Cart", deviceType: "Pc" };

const REMOTE_READ_URL   = 'https://locvps.dragonisheep.com/surge?token=xbox123';
const REMOTE_COMMIT_URL = 'https://locvps.dragonisheep.com/surge/commit?token=xbox123';
const LOCAL_KEY         = 'XboxProductList';

const MUID  = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

let logBuffer = [];
const results = { success: [], failure: [] };
const successKeys = [];
let currentIndex = 0;
let productList = [];
let sourceLabel = "";
let useRemote = false;
let _remoteGroupRaw = null; // 保留原始远程数据，用于构建 failedProducts

function log(type, message, detail = "") {
  const icon  = type === "success" ? "✅" : (type === "error" ? "❌" : "ℹ️");
  const color = type === "success" ? "green" : (type === "error" ? "red" : "#666");
  console.log(`${icon} ${message} ${detail}`);
  logBuffer.push(`<div style="color:${color}; border-bottom:1px solid #eee; padding:5px;">${icon} ${message} <small>${detail}</small></div>`);
}

const generateRiskSessionId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c =>
    (c === "x" ? (Math.random() * 16 | 0) : ((Math.random() * 4 | 8) | 0)).toString(16));

const toNum = k => { const m = /^product(\d+)$/.exec(k) || /^\((\d+)\)/.exec(k); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; };
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
    .filter(k => normEntry(parsed[k]) !== null)  // 接受任意 key，只要 value 有效
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

  const showResult = (ngnStr = '', failedNames = []) => {
    const priceNote = ngnStr ? ` | ${ngnStr}` : '';
    const notifSubtitle = failureCount === 0
      ? `成功: ${successCount}${priceNote}`
      : `成功: ${successCount} / 失败: ${failureCount}${priceNote}`;

    const failedHtml = failedNames.length > 0
      ? `<div style="color:red;margin-top:10px;"><b>加购失败的游戏：</b><ul>${failedNames.map(n => `<li>${n}</li>`).join('')}</ul></div>`
      : '';
    const priceHtml = ngnStr
      ? `<div style="margin-top:10px;font-weight:bold;">游戏总价: ${ngnStr}</div>`
      : '';

    $notification.post(
      "🛒 Xbox 加购完成",
      notifSubtitle,
      `来源: ${sourceLabel}`
    );
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xbox Cart</title></head><body style="font-family:sans-serif;padding:20px;"><h3>执行结果: 成功 ${successCount} / 失败 ${failureCount} | 来源: ${sourceLabel}</h3>${priceHtml}${failedHtml}<div style="background:#f9f9f9;padding:10px;margin-top:10px;">${logBuffer.join("")}</div></body></html>`;
    $done({ response: { status: 200, headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" }, body: html } });
  };

  if (useRemote) {
    // 构建失败的 product 对象：优先从原始远程数据取（保留 PriceNGN 等完整字段）
    const failedProducts = {};
    for (const item of productList) {
      if (results.failure.includes(item.productId)) {
        // 从原始数据里找到对应的完整 product（含 PriceNGN）
        const originalProduct = _remoteGroupRaw ? _remoteGroupRaw[item.key] : null;
        failedProducts[item.key] = originalProduct || {
          ProductId: item.productId,
          SkuId: item.skuId,
          AvailabilityId: item.availabilityId
        };
      }
    }

    const logMsg = failureCount === 0
      ? "全部成功，提交 commit（弹出当前组）"
      : `${failureCount} 个失败，提交 commit（只保留失败的 product，其余组不变）`;
    log("info", logMsg);

    // 提交结果到服务端，响应包含价格信息
    $httpClient.post({
      url: REMOTE_COMMIT_URL,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remaining: failedProducts })
    }, (commitErr, commitResp, commitData) => {
      // 解析服务端返回的价格信息
      let priceInfo = {};
      try { priceInfo = JSON.parse(commitData || '{}'); } catch (_) {}

      // 全部成功：groupNGN；部分失败：successNGN + failedNames
      const totalNGN = priceInfo.groupNGN ?? priceInfo.successNGN ?? 0;
      const ngnStr = totalNGN > 0 ? `${totalNGN.toFixed(2)} NGN` : '';
      const failedNames = priceInfo.failedNames || [];

      showResult(ngnStr, failedNames);
    });

  } else {
    // 本地模式：清理已成功的 key
    try {
      let storeObj; try { storeObj = JSON.parse($persistentStore.read(LOCAL_KEY) || "{}"); } catch { storeObj = {}; }
      for (const k of successKeys) {
        if (k && Object.prototype.hasOwnProperty.call(storeObj, k)) delete storeObj[k];
      }
      const remainingCount = Object.keys(storeObj).filter(k => /^product\d+$/.test(k)).length;
      $persistentStore.write(JSON.stringify(storeObj), LOCAL_KEY);
      log("info", "本地清理完成", `剩余: ${remainingCount}`);
    } catch (e) { log("error", "清理异常", String(e)); }
    showResult();
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
    if (useRemote) {
      // 远程为空也要提交 commit 释放锁
      $httpClient.post({
        url: REMOTE_COMMIT_URL,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remaining: {} })
      }, () => $done({}));
    } else {
      $done({});
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
// 服务端有锁机制，客户端无需时间锁
$httpClient.get(REMOTE_READ_URL, (error, response, data) => {
  let remoteGroup = null;
  let groupIndex = null;

  if (!error && data) {
    try {
      const payload = JSON.parse((data || '').trim() || '{}');
      if (payload.ok && payload.currentGroup) {
        const keys = Object.keys(payload.currentGroup);
        if (keys.length > 0) {
          remoteGroup = payload.currentGroup;
          groupIndex = payload.currentGroupIndex;
        }
      }
    } catch (_) {}
  }

  if (remoteGroup) {
    useRemote = true;
    sourceLabel = `远程第 ${groupIndex} 组`;
    log("info", "使用远程待同步 Product", `第 ${groupIndex} 组，共 ${Object.keys(remoteGroup).length} 个`);
    productList = parseProductList(JSON.stringify(remoteGroup));
    // ★ 保留原始数据，供构建 failedProducts 时还原完整字段（含 PriceNGN）
    _remoteGroupRaw = remoteGroup;
    startTask();
  } else {
    useRemote = false;
    sourceLabel = "本地";
    const localRaw = $persistentStore.read(LOCAL_KEY) || "{}";
    productList = parseProductList(localRaw);
    if (!error) {
      log("info", "远程队列为空，使用本地 Product");
    } else {
      log("info", "远程连接失败，使用本地 Product", String(error));
    }
    startTask();
  }
});
