/**
 * Xbox Cart Multi-Region Runner
 * 远程路径: https://raw.githubusercontent.com/dragonisheep/Surge/refs/heads/master/Scripts/AddMsGames.js
 *
 * 完全独立脚本，通过 https://addmsgames.com 触发
 *
 * 使用方式：
 * - 访问 https://addmsgames.com         → 显示区域选择界面
 * - 访问 https://addmsgames.com/?region=US → 直接执行美区加购
 * - 访问 https://addmsgames.com/?region=NG → 直接执行尼区加购
 * - 访问 https://addmsgames.com/?region=AR → 直接执行阿区加购
 *
 * PersistentStore Key 说明（三区共用，与 NewAddToCart_Web.js 完全一致）：
 * - MUID: cart-x-authorization-muid
 * - CV:   cart-ms-cv
 * - 列表: XboxProductList
 *
 * 流程：
 * 1. GET 读取远程当前组（服务端加锁，带 market 参数区分三区）
 * 2. 执行加购
 * 3. POST /surge/commit 提交结果
 * 4. 若远程无数据，回退到本地对应区域的 XboxProductList-{REGION}
 */

// ========================= 区域配置 =========================
const REGION_CONFIGS = {
  US: {
    label:        "美区",
    flag:         "🇺🇸",
    color:        "#4a90e2",
    MARKET:       "US",
    LOCALE:       "en-us",
    FRIENDLY_NAME:"cart-US",
    MUID_KEY:     "cart-x-authorization-muid",
    CV_KEY:       "cart-ms-cv",
    LOCAL_KEY:    "XboxProductList",
    CURRENCY:     "USD",
  },
  NG: {
    label:        "尼区",
    flag:         "🇳🇬",
    color:        "#52b043",
    MARKET:       "NG",
    LOCALE:       "en-ng",
    FRIENDLY_NAME:"cart-NG",
    MUID_KEY:     "cart-x-authorization-muid",
    CV_KEY:       "cart-ms-cv",
    LOCAL_KEY:    "XboxProductList",
    CURRENCY:     "NGN",
  },
  AR: {
    label:        "阿区",
    flag:         "🇦🇷",
    color:        "#e8a838",
    MARKET:       "AR",
    LOCALE:       "es-ar",
    FRIENDLY_NAME:"cart-AR",
    MUID_KEY:     "cart-x-authorization-muid",
    CV_KEY:       "cart-ms-cv",
    LOCAL_KEY:    "XboxProductList",
    CURRENCY:     "ARS",
  },
};

const REMOTE_BASE_READ   = "https://locvps.dragonisheep.com/surge?token=xbox123";
const REMOTE_BASE_COMMIT = "https://locvps.dragonisheep.com/surge/commit?token=xbox123";
const CLIENT_CONTEXT     = { client: "UniversalWebStore.Cart", deviceType: "Pc" };
const API_URL            = "https://cart.production.store-web.dynamics.com/cart/v1.0/cart/loadCart?cartType=consumer&appId=StoreWeb";

// ========================= 解析 region 参数 =========================
function getRegionParam() {
  try {
    const url = $request.url || "";
    const m = url.match(/[?&]region=([A-Za-z]{2})/);
    if (m) return m[1].toUpperCase();
  } catch (_) {}
  return null;
}

// ========================= 区域选择页面 =========================
function serveSelector() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Xbox · 区域加购</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Noto+Sans+SC:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0b0b0b;
    --surface:  #141414;
    --border:   #222;
    --text:     #ddd;
    --muted:    #555;
    --green:    #107c10;
    --green-hi: #52b043;
  }

  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: 'Noto Sans SC', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 32px 20px;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,124,16,0.12) 0%, transparent 60%);
  }

  /* Xbox logo bar */
  .xbox-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 32px;
  }
  .xbox-sphere {
    width: 36px; height: 36px;
    background: radial-gradient(circle at 38% 38%, #4caf50, #107c10 60%, #0a5a0a);
    border-radius: 50%;
    box-shadow: 0 0 18px rgba(82,176,67,0.35);
    position: relative;
    flex-shrink: 0;
  }
  .xbox-sphere::before,
  .xbox-sphere::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }
  .xbox-sphere::before {
    border-top: 1.5px solid rgba(255,255,255,0.25);
    border-left: 1.5px solid rgba(255,255,255,0.1);
    border-right: 1.5px solid transparent;
    border-bottom: 1.5px solid transparent;
    transform: rotate(-20deg);
  }
  .xbox-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #fff;
  }
  .xbox-label span { color: var(--green-hi); }

  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(22px, 5.5vw, 32px);
    font-weight: 600;
    letter-spacing: 1px;
    color: #fff;
    text-align: center;
    margin-bottom: 6px;
  }

  .hint {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 36px;
    text-align: center;
    letter-spacing: 0.5px;
  }

  /* Cards */
  .cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 420px;
  }

  .card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    color: var(--text);
    position: relative;
    overflow: hidden;
    transition: border-color .2s, background .2s, transform .15s;
    -webkit-tap-highlight-color: transparent;
  }

  .card::after {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--c);
    opacity: 0;
    transition: opacity .2s;
  }

  .card:hover, .card:active {
    border-color: var(--c);
    background: #1b1b1b;
    transform: translateX(4px);
  }
  .card:hover::after, .card:active::after { opacity: 1; }

  .card-flag  { font-size: 30px; line-height: 1; flex-shrink: 0; }
  .card-info  { flex: 1; }
  .card-name  {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #fff;
  }
  .card-meta  { font-size: 11px; color: var(--muted); margin-top: 2px; letter-spacing: 0.8px; }
  .card-arrow {
    font-size: 20px;
    color: var(--border);
    transition: color .2s, transform .2s;
    flex-shrink: 0;
  }
  .card:hover .card-arrow { color: var(--c); transform: translateX(3px); }

  /* Loading */
  .overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.88);
    z-index: 999;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
  }
  .overlay.on { display: flex; }
  .spin {
    width: 44px; height: 44px;
    border: 3px solid #222;
    border-top-color: var(--green-hi);
    border-radius: 50%;
    animation: spin .75s linear infinite;
  }
  .spin-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 15px;
    letter-spacing: 2px;
    color: var(--muted);
    text-transform: uppercase;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  footer {
    margin-top: 44px;
    font-size: 11px;
    color: #2a2a2a;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
</style>
</head>
<body>

<div class="xbox-bar">
  <div class="xbox-sphere"></div>
  <div class="xbox-label">X<span>box</span></div>
</div>

<h1>选择加购区域</h1>
<p class="hint">点击区域后将自动执行加购任务</p>

<div class="cards">
  <a class="card" style="--c:#4a90e2" href="https://addmsgames.com/?region=US" onclick="go(this,'美区')">
    <span class="card-flag">🇺🇸</span>
    <div class="card-info">
      <div class="card-name">美区</div>
      <div class="card-meta">MARKET: US · en-us</div>
    </div>
    <span class="card-arrow">›</span>
  </a>
  <a class="card" style="--c:#52b043" href="https://addmsgames.com/?region=NG" onclick="go(this,'尼区')">
    <span class="card-flag">🇳🇬</span>
    <div class="card-info">
      <div class="card-name">尼区</div>
      <div class="card-meta">MARKET: NG · en-ng</div>
    </div>
    <span class="card-arrow">›</span>
  </a>
  <a class="card" style="--c:#e8a838" href="https://addmsgames.com/?region=AR" onclick="go(this,'阿区')">
    <span class="card-flag">🇦🇷</span>
    <div class="card-info">
      <div class="card-name">阿区</div>
      <div class="card-meta">MARKET: AR · es-ar</div>
    </div>
    <span class="card-arrow">›</span>
  </a>
</div>

<footer>Surge · Xbox Cart Runner</footer>

<div class="overlay" id="ov">
  <div class="spin"></div>
  <div class="spin-label" id="ovLabel">正在准备...</div>
</div>

<script>
function go(el, name) {
  document.getElementById('ovLabel').textContent = '正在执行 ' + name + ' 加购...';
  document.getElementById('ov').classList.add('on');
}
</script>
</body>
</html>`;

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache"
      },
      body: html
    }
  });
}

// ========================= 加购逻辑 =========================
function runCart(regionCode) {
  const cfg = REGION_CONFIGS[regionCode];
  if (!cfg) {
    $notification.post("❌ AddMsGames 错误", `未知区域: ${regionCode}`, "");
    $done({});
    return;
  }

  const { label, flag, color, MARKET, LOCALE, FRIENDLY_NAME, MUID_KEY, CV_KEY, LOCAL_KEY, CURRENCY } = cfg;
  const MUID  = $persistentStore.read(MUID_KEY);
  const MS_CV = $persistentStore.read(CV_KEY);

  const REMOTE_READ_URL = `${REMOTE_BASE_READ}&market=${MARKET}`;
  const COMMIT_URL      = `${REMOTE_BASE_COMMIT}&market=${MARKET}`;

  const HEADERS = {
    "content-type": "application/json",
    "accept": "*/*",
    "x-authorization-muid": MUID,
    "ms-cv": MS_CV,
    "origin": "https://www.microsoft.com",
    "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  };

  let logBuffer    = [];
  const results    = { success: [], failure: [] };
  const successKeys = [];
  let currentIndex  = 0;
  let productList   = [];
  let sourceLabel   = "";
  let useRemote     = false;

  function log(type, message, detail = "") {
    const icon  = type === "success" ? "✅" : (type === "error" ? "❌" : "ℹ️");
    const clr   = type === "success" ? "#52b043" : (type === "error" ? "#e05050" : "#777");
    console.log(`${icon} [${regionCode}] ${message} ${detail}`);
    logBuffer.push(`<li style="color:${clr};padding:6px 0;border-bottom:1px solid #1e1e1e">${icon} ${message} <small style="opacity:.6">${detail}</small></li>`);
  }

  const riskId = () =>
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
      .map(k => { const n = normEntry(parsed[k]); return n ? { key: k, ...n } : null; })
      .filter(Boolean);
  }

  function buildResultPage(ngnStr, failedNames) {
    const sc = results.success.length;
    const fc = results.failure.length;
    const failedHtml = failedNames.length
      ? `<div class="failed-box"><b>加购失败的游戏：</b><ul>${failedNames.map(n => `<li>${n}</li>`).join("")}</ul></div>`
      : "";
    const priceHtml = ngnStr
      ? `<div class="price-box" style="border-color:${color}">游戏总价 <span style="color:${color}">${ngnStr}</span></div>`
      : "";
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Xbox · ${flag}${label} 结果</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Noto+Sans+SC:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0b0b0b;color:#ddd;font-family:'Noto Sans SC',sans-serif;padding:24px 18px;max-width:520px;margin:0 auto;-webkit-font-smoothing:antialiased}
  .back{display:inline-flex;align-items:center;gap:6px;margin-bottom:20px;padding:8px 14px;background:#141414;border:1px solid #222;border-radius:3px;color:${color};text-decoration:none;font-size:13px;letter-spacing:.5px}
  .header{display:flex;align-items:center;gap:10px;margin-bottom:18px}
  .flag{font-size:28px}
  .title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;color:#fff;letter-spacing:1px}
  .stats{display:flex;gap:10px;margin-bottom:18px}
  .stat{flex:1;background:#141414;border:1px solid #222;border-radius:3px;padding:12px;text-align:center}
  .stat-num{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700}
  .stat-lbl{font-size:11px;color:#555;margin-top:2px;letter-spacing:.5px}
  .s-ok{color:#52b043}.s-err{color:#e05050}
  .price-box{background:#141414;border:1px solid;border-radius:3px;padding:12px 16px;margin-bottom:14px;font-size:14px}
  .price-box span{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;margin-left:8px}
  .failed-box{background:#1a0e0e;border:1px solid #3a1a1a;border-radius:3px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:#e05050}
  .failed-box ul{margin-top:8px;padding-left:18px;line-height:1.8}
  .source{font-size:11px;color:#444;margin-bottom:14px;letter-spacing:.5px}
  .logs{background:#111;border-radius:3px;padding:10px 14px}
  .logs ul{list-style:none;font-size:12px;line-height:1.6}
</style>
</head>
<body>
<a class="back" href="https://addmsgames.com">← 返回区域选择</a>
<div class="header">
  <span class="flag">${flag}</span>
  <span class="title">${label} · 加购完成</span>
</div>
<div class="stats">
  <div class="stat"><div class="stat-num s-ok">${sc}</div><div class="stat-lbl">成功</div></div>
  <div class="stat"><div class="stat-num s-err">${fc}</div><div class="stat-lbl">失败</div></div>
  <div class="stat"><div class="stat-num" style="color:#888">${sc+fc}</div><div class="stat-lbl">合计</div></div>
</div>
${priceHtml}
${failedHtml}
<div class="source">来源: ${sourceLabel}</div>
<div class="logs"><ul>${logBuffer.join("")}</ul></div>
</body>
</html>`;
  }

  function finalizeAndClean() {
    const fc = results.failure.length;
    const sc = results.success.length;

    const finish = (ngnStr = "", failedNames = []) => {
      const priceNote = ngnStr ? ` | ${ngnStr}` : "";
      const sub = fc === 0 ? `成功: ${sc}${priceNote}` : `成功: ${sc} / 失败: ${fc}${priceNote}`;
      $notification.post(`🛒 Xbox ${flag}${label} 加购完成`, sub, `来源: ${sourceLabel}`);
      $done({
        response: {
          status: 200,
          headers: { "Content-Type": "text/html;charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" },
          body: buildResultPage(ngnStr, failedNames)
        }
      });
    };

    if (useRemote) {
      const failedProducts = {};
      let fi = 1;
      for (const item of productList) {
        if (results.failure.includes(item.productId)) {
          failedProducts[`product${fi++}`] = { ProductId: item.productId, SkuId: item.skuId, AvailabilityId: item.availabilityId };
        }
      }
      log("info", fc === 0 ? "全部成功，提交 commit（弹出当前组）" : `${fc} 个失败，提交 commit（保留失败部分）`);
      $httpClient.post({
        url: COMMIT_URL,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remaining: failedProducts })
      }, (_e, _r, commitData) => {
        let info = {};
        try { info = JSON.parse(commitData || "{}"); } catch (_) {}
        const total = info.groupNGN ?? info.successNGN ?? 0;
        const ngnStr = total > 0 ? `${total.toFixed(2)} ${CURRENCY}` : "";
        finish(ngnStr, info.failedNames || []);
      });
    } else {
      try {
        let store; try { store = JSON.parse($persistentStore.read(LOCAL_KEY) || "{}"); } catch { store = {}; }
        for (const k of successKeys) {
          if (k && Object.prototype.hasOwnProperty.call(store, k)) delete store[k];
        }
        const rem = Object.keys(store).filter(k => /^product\d+$/.test(k)).length;
        $persistentStore.write(JSON.stringify(store), LOCAL_KEY);
        log("info", "本地清理完成", `剩余: ${rem}`);
      } catch (e) { log("error", "清理异常", String(e)); }
      finish();
    }
  }

  function sendRequest() {
    if (currentIndex >= productList.length) return finalizeAndClean();
    const { key, productId, skuId, availabilityId } = productList[currentIndex];
    $httpClient.put({
      url: API_URL,
      headers: HEADERS,
      body: JSON.stringify({
        locale: LOCALE, market: MARKET,
        catalogClientType: "storeWeb",
        friendlyName: FRIENDLY_NAME,
        riskSessionId: riskId(),
        clientContext: CLIENT_CONTEXT,
        itemsToAdd: { items: [{ productId, skuId, availabilityId, campaignId: "xboxcomct", quantity: 1 }] }
      })
    }, (error, response) => {
      if (error || response.status !== 200) {
        results.failure.push(productId);
        log("error", "失败", productId);
      } else {
        results.success.push(productId);
        if (key) successKeys.push(key);
        log("success", "成功", productId);
      }
      currentIndex++;
      setTimeout(sendRequest, 50);
    });
  }

  function startTask() {
    if (!MUID || !MS_CV) {
      $notification.post(`❌ Xbox ${label} 错误`, `缺少 MUID 或 CV`, `请写入 ${MUID_KEY} / ${CV_KEY}`);
      $done({});
      return;
    }
    if (productList.length === 0) {
      $notification.post(`⚠️ Xbox ${label}`, "列表为空，无需执行", `来源: ${sourceLabel}`);
      if (useRemote) {
        $httpClient.post({ url: COMMIT_URL, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remaining: {} }) }, () => $done({}));
      } else {
        $done({});
      }
      return;
    }
    log("info", `开始 ${flag}${label} 加购`, `数量: ${productList.length}，来源: ${sourceLabel}`);
    sendRequest();
  }

  // 主流程
  $httpClient.get(REMOTE_READ_URL, (err, _res, data) => {
    let remoteGroup = null, groupIndex = null;
    if (!err && data) {
      try {
        const p = JSON.parse((data || "").trim() || "{}");
        if (p.ok && p.currentGroup && Object.keys(p.currentGroup).length > 0) {
          remoteGroup = p.currentGroup;
          groupIndex  = p.currentGroupIndex;
        }
      } catch (_) {}
    }
    if (remoteGroup) {
      useRemote   = true;
      sourceLabel = `远程第 ${groupIndex} 组`;
      log("info", `使用远程 Product`, `${flag}${label} · 第 ${groupIndex} 组，共 ${Object.keys(remoteGroup).length} 个`);
      productList = parseProductList(JSON.stringify(remoteGroup));
    } else {
      useRemote   = false;
      sourceLabel = "本地";
      productList = parseProductList($persistentStore.read(LOCAL_KEY) || "{}");
      log("info", err ? `远程连接失败，使用本地 [${label}]` : `远程队列为空，使用本地 [${label}]`, err ? String(err) : "");
    }
    startTask();
  });
}

// ========================= 入口 =========================
const region = getRegionParam();
if (!region) {
  serveSelector();
} else {
  runCart(region);
}
