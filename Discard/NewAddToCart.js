const MARKET = "NG";
const LOCALE = "en-ng";
const FRIENDLY_NAME = `cart-${MARKET}`;
const CLIENT_CONTEXT = { client: "UniversalWebStore.Cart", deviceType: "Pc" };

const LIST_RAW = $persistentStore.read("XboxProductList") || "{}";
const MUID = $persistentStore.read("cart-x-authorization-muid");
const MS_CV = $persistentStore.read("cart-ms-cv");

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

function finalizeAndClean() {
  const successCount = results.success.length;
  const failureList = results.failure.join("\n");
  let remainingCount = 0;

  try {
    let storeObj; try { storeObj = JSON.parse($persistentStore.read("XboxProductList") || "{}"); } catch { storeObj = {}; }
    for (const k of successKeys) if (k && Object.prototype.hasOwnProperty.call(storeObj, k)) delete storeObj[k];
    remainingCount = Object.keys(storeObj).filter(k => /^product\d+$/.test(k)).length;
    $persistentStore.write(JSON.stringify(storeObj), "XboxProductList");
  } catch (e) {
    console.log("清理存储异常：" + e);
  }

  const subtitle = `成功: ${successCount} 个 / 共 ${productList.length} 个`;
  const body = (failureList || "所有请求均成功") + `\n剩余待处理 product：${remainingCount} 个`;
  $notification.post("🎮 操作完成", subtitle, body);
  $done();
}

function sendRequest() {
  if (currentIndex >= productList.length) return finalizeAndClean();

  const { key, productId, skuId, availabilityId } = productList[currentIndex];
  const riskSessionId = generateRiskSessionId();
  const idTriple = `${productId}/${skuId}/${availabilityId}`;

  const timeoutId = setTimeout(() => {
    recordResult(idTriple, "超时");
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
        recordResult(idTriple, `HTTP ${response ? response.status : "Error"}`);
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
  console.log(`✅ ${id} (${key})`);
}

function recordResult(id, reason) {
  results.failure.push(`${id}: ${reason}`);
  console.log(`❌ ${id} - ${reason}`);
}

function proceed() {
  currentIndex++;
  setTimeout(sendRequest, 10);
}

if (!MUID || !MS_CV) {
  console.log("缺少必要参数 MUID 或 MS_CV");
  $notification.post("配置错误", "缺少必要参数 MUID 或 MS_CV", "");
  $done();
} else if (productList.length === 0) {
  console.log("XboxProductList 为空或无有效条目");
  $notification.post("无任务", "XboxProductList 为空或无有效条目", "");
  $done();
} else {
  console.log(`开始执行请求（共 ${productList.length} 个）`);
  sendRequest();
}
