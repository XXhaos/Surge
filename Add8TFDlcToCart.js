/**
 * Surge Script - 微软购物车批量添加
 * 特性：动态生成 riskSessionId
 */

// ==== 配置项 ==== //
const PRODUCT_IDS = $persistentStore.read("productId"); // 格式：id1&id2
const MUID = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

// ==== 工具函数 ==== //
const generateRiskSessionId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => (c === "x" ? (Math.random()*16|0).toString(16) : (Math.random()*4|8).toString(16)));

// ==== 执行逻辑 ==== //
const productIdArray = PRODUCT_IDS?.split("&") || [];
const results = { success: [], failure: [] };
let currentIndex = 0;

const API_URL = "https://cart.production.store-web.dynamics.com/cart/v1.0/cart/loadCart?cartType=consumer&appId=StoreWeb";

const HEADERS = {
  "content-type": "application/json",
  "accept": "*/*",
  "x-authorization-muid": MUID,
  "sec-fetch-site": "cross-site",
  "x-validation-field-1": "9pgbhbppjf2b",
  "ms-cv": MS_CV,
  "accept-language": "ha-Latn-NG,ha;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "sec-fetch-mode": "cors",
  "origin": "https://www.microsoft.com",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/133.0.3065.54 Version/18.0 Mobile/15E148 Safari/604.1",
  "referer": "https://www.microsoft.com/",
  "x-ms-vector-id": "",
  "sec-fetch-dest": "empty"
};

function sendRequest() {
  if (currentIndex >= productIdArray.length) {
    const successCount = results.success.length;
    const failureList = results.failure.join("\n");
    $notification.post(
      "🎮 操作完成",
      `成功: ${successCount}个`,
      failureList || "所有请求均成功"
    );
    $done();
    return;
  }

  const productId = productIdArray[currentIndex];
  const riskSessionId = generateRiskSessionId();
  const timeoutId = setTimeout(() => {
    recordResult(productId, "超时");
    proceed();
  }, 30000);

  $httpClient.put({
    url: API_URL,
    headers: HEADERS,
    body: JSON.stringify({
      locale: "en-ng",
      market: "NG",
      catalogClientType: "storeWeb",
      friendlyName: "cart-NG",
      riskSessionId: riskSessionId,
      clientContext: { client: "UniversalWebStore.Cart", deviceType: "Pc" },
      itemsToAdd: { items: [{ productId, skuId: "0010", quantity: 1 }] }
    })
  }, (error, response) => {
    clearTimeout(timeoutId);
    error ? recordResult(productId, error) 
          : response.status === 200 ? handleSuccess(productId) 
          : recordResult(productId, `HTTP ${response.status}`);
    proceed();
  });
}

// ==== 辅助函数 ==== //
function handleSuccess(id) {
  results.success.push(id);
  console.log(`✅ ${id}`);
}

function recordResult(id, reason) {
  results.failure.push(`${id}: ${reason}`);
  console.log(`❌ ${id} - ${reason}`);
}

function proceed() {
  currentIndex++;
  setTimeout(sendRequest, 100); // 请求间隔0.0秒
}

// ==== 启动检查 ==== //
if (!MUID || !PRODUCT_IDS) {
  console.log("⚠️ 配置错误 - 缺少必要参数 MUID 或 PRODUCT_IDS");
  $notification.post("配置错误", "缺少必要参数", "");
  $done();
} else {
  console.log("🚀 开始执行请求");
  sendRequest();
}