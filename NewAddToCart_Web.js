/**
 * Modified for Web Response
 * Trigger: http://add_to_cart.com
 */

const MARKET = "NG";
const LOCALE = "en-ng";
const FRIENDLY_NAME = `cart-${MARKET}`;
const CLIENT_CONTEXT = { client: "UniversalWebStore.Cart", deviceType: "Pc" };

const LIST_RAW = $persistentStore.read("XboxProductList") || "{}";
const MUID = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

// 用于收集网页显示的日志
let logHtml = [];

const generateRiskSessionId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c =>
    (c === "x" ? (Math.random() * 16 | 0) : ((Math.random() * 4 | 8) | 0)).toString(16)
  );

const toNum = k => {
  const m = /^product(\d+)$/.exec(k);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
};

const normEntry = v => {
  if (!v || typeof v !== "object") return null;
  const productId = String(v.ProductId ?? v.productId ?? "").trim();
  const skuId = String(v.SkuId ?? v.skuId ?? "").trim();
  const availabilityId = String(v.AvailabilityId ?? v.availabilityId ?? "").trim();
  if (!productId || !skuId || !availabilityId) return null;
  return { productId, skuId, availabilityId };
};

let parsed; try { parsed = JSON.parse(LIST_RAW); } catch { parsed = {}; }

const productList = Object.keys(parsed)
  .filter(k => /^product\d+$/.test(k))
  .sort((a,b) => toNum(a) - toNum(b))
  .map(k => {
    const norm = normEntry(parsed[k]);
    return norm ? { key: k, ...norm } : null;
  })
  .filter(Boolean);

const results = { success: [], failure: [] };
const successKeys = [];
let currentIndex = 0;

const API_URL = "https://cart.production.store-web.dynamics.com/cart/v1.0/cart/loadCart?cartType=consumer&appId=StoreWeb";

const HEADERS = {
  "content-type": "application/json",
  "accept": "*/*",
  "x-authorization-muid": MUID,
  "sec-fetch-site": "cross-site",
  "x-validation-field-1": "9pgbhbppjf2b",
  "ms-cv": MS_CV,
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "sec-fetch-mode": "cors",
  "origin": "https://www.microsoft.com",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/133.0.3065.54 Version/18.0 Mobile/15E148 Safari/604.1",
  "referer": "https://www.microsoft.com/",
  "x-ms-vector-id": "",
  "sec-fetch-dest": "empty"
};

// 辅助：返回HTML响应
function returnHtmlResponse(title, content) {
    const style = `
    <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; background: #f4f4f4; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; font-size: 20px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .log-item { border-bottom: 1px solid #eee; padding: 8px 0; font-size: 14px; }
        .stat { margin-bottom: 15px; font-weight: bold; }
    </style>`;
    
    const html = `<!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${style}</head>
    <body>
        <div class="card">
            <h1>${title}</h1>
            ${content}
        </div>
    </body>
    </html>`;

    $done({
        response: {
            status: 200,
            headers: { "Content-Type": "text/html;charset=utf-8" },
            body: html
        }
    });
}

function finalizeAndClean() {
  const successCount = results.success.length;
  const failureCount = results.failure.length;
  let remainingCount = 0;
  let cleanStatus = "无需清理";

  try {
    let storeObj; try { storeObj = JSON.parse($persistentStore.read("XboxProductList") || "{}"); } catch { storeObj = {}; }
    for (const k of successKeys) if (k && Object.prototype.hasOwnProperty.call(storeObj, k)) delete storeObj[k];
    remainingCount = Object.keys(storeObj).filter(k => /^product\d+$/.test(k)).length;
    $persistentStore.write(JSON.stringify(storeObj), "XboxProductList");
    cleanStatus = "清理完成";
  } catch (e) {
    cleanStatus = "清理异常: " + e;
    console.log("清理存储异常：" + e);
  }

  // 构建网页内容
  let htmlContent = `
    <div class="stat">
        <span class="success">成功: ${successCount}</span> | 
        <span class="error">失败: ${failureCount}</span> | 
        <span>剩余: ${remainingCount}</span>
    </div>
    <div class="logs">
        ${logHtml.join("")}
    </div>
    <p style="color:#666; font-size:12px; margin-top:20px;">存储状态: ${cleanStatus}</p>
  `;

  // 发送通知（可选，为了双重保险）
  $notification.post("🎮 操作完成", `成功 ${successCount} / 失败 ${failureCount}`, `剩余待处理: ${remainingCount}`);
  
  returnHtmlResponse("🛒 Xbox 购物车执行报告", htmlContent);
}

function sendRequest() {
  if (currentIndex >= productList.length) return finalizeAndClean();

  const { key, productId, skuId, availabilityId } = productList[currentIndex];
  const riskSessionId = generateRiskSessionId();
  const idTriple = `${productId} / ${skuId}`;

  const timeoutId = setTimeout(() => {
    recordResult(idTriple, "超时", key);
    proceed();
  }, 30000);

  const bodyObj = {
    locale: LOCALE,
    market: MARKET,
    catalogClientType: "storeWeb",
    friendlyName: FRIENDLY_NAME,
    riskSessionId,
    clientContext: CLIENT_CONTEXT,
    itemsToAdd: {
      items: [
        {
          productId,
          skuId,
          availabilityId,
          campaignId: "xboxcomct",
          quantity: 1
        }
      ]
    }
  };

  $httpClient.put(
    { url: API_URL, headers: HEADERS, body: JSON.stringify(bodyObj) },
    (error, response) => {
      clearTimeout(timeoutId);
      if (error || response.status !== 200) {
        recordResult(idTriple, `HTTP ${response ? response.status : "Error"}`, key);
      } else {
        handleSuccess(idTriple, key);
      }
      proceed();
    }
  );
}

function handleSuccess(id, key) {
  results.success.push(id);
  if (key) successKeys.push(key);
  const msg = `✅ ${id} (${key})`;
  console.log(msg);
  logHtml.push(`<div class="log-item success">${msg}</div>`);
}

function recordResult(id, reason, key) {
  const msg = `${id}: ${reason}`;
  results.failure.push(msg);
  console.log(`❌ ${msg}`);
  logHtml.push(`<div class="log-item error">❌ ${msg} (${key || 'N/A'})</div>`);
}

function proceed() {
  currentIndex++;
  // 稍微增加间隔，避免瞬间并发过高
  setTimeout(sendRequest, 50);
}

// 入口检查
if (!MUID || !MS_CV) {
  console.log("缺少必要参数 MUID 或 MS_CV");
  returnHtmlResponse("配置错误", "<p class='error'>缺少必要参数 MUID 或 MS_CV，请先抓包获取。</p>");
} else if (productList.length === 0) {
  console.log("XboxProductList 为空或无有效条目");
  returnHtmlResponse("无任务", "<p>XboxProductList 为空或无有效条目，请先添加商品。</p>");
} else {
  console.log(`开始执行请求（共 ${productList.length} 个）`);
  // 初始化加载界面（如果列表很长，这一步可能不会立即显示，因为JS是单线程的，这里直接开始处理）
  sendRequest();
}
