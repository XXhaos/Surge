/**
 * SyncXboxCloud.js - 分组队列版
 */

const workerUrl = 'https://ngaccountant.biubiubiu-lalala.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList';

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderUI(title, message, type = "success") {
  const colorMap = {
    success: "#107C10",
    warning: "#d83b01",
    error: "#c50f1f",
    info: "#0078d4"
  };
  const color = colorMap[type] || "#0078d4";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f1115;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
      padding: 20px;
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: #171a21;
      border-radius: 16px;
      border: 1px solid #252a35;
      border-top: 5px solid ${color};
      padding: 24px 22px 20px;
      box-sizing: border-box;
    }
    h1 {
      margin: 0 0 14px;
      font-size: 22px;
      color: ${color};
    }
    .msg {
      color: #cfd6e4;
      font-size: 14px;
      line-height: 1.7;
      word-break: break-word;
    }
    .msg ul {
      margin: 10px 0 0;
      padding-left: 20px;
      text-align: left;
    }
    .msg li {
      margin: 6px 0;
    }
    button {
      margin-top: 18px;
      border: none;
      background: ${color};
      color: white;
      padding: 10px 22px;
      border-radius: 999px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHTML(title)}</h1>
    <div class="msg">${message}</div>
    <button onclick="history.back()">确定</button>
  </div>
</body>
</html>`;

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: html
    }
  });
}

$httpClient.get(workerUrl, (error, response, data) => {
  if (error) {
    $notification.post("❌ 同步失败", "无法连接 Worker", String(error));
    return renderUI("❌ 连接失败", `<p>${escapeHTML(String(error))}</p>`, "error");
  }

  let payload;
  try {
    payload = JSON.parse((data || '').trim() || '{}');
  } catch (e) {
    $notification.post("❌ 同步失败", "返回 JSON 无法解析", "");
    return renderUI("❌ 解析错误", `<p>${escapeHTML(String(e.message || e))}</p>`, "error");
  }

  const currentGroup = payload.currentGroup || {};
  const keys = Object.keys(currentGroup);

  if (!keys.length) {
    $notification.post("📭 当前无待同步组", "云端队列为空", "");
    return renderUI(
      "📭 没有可同步内容",
      `<p>当前没有待同步的 Product 分组。</p>`,
      "warning"
    );
  }

  const writeOK = $persistentStore.write(JSON.stringify(currentGroup), storeKey);
  if (!writeOK) {
    $notification.post("❌ 同步失败", "写入 Surge 存储失败", "");
    return renderUI("❌ 写入失败", `<p>无法写入 Surge 本地存储。</p>`, "error");
  }

  // 写入成功后，清掉当前这组
  $httpClient.get(workerUrl + '&action=clear', (clearError, clearResponse, clearData) => {
    let clearPayload = {};
    try {
      clearPayload = JSON.parse((clearData || '').trim() || '{}');
    } catch (_) {}

    const remainingGroups = typeof clearPayload.remainingGroups === 'number'
      ? clearPayload.remainingGroups
      : (payload.remainingAfterCurrent || 0);

    const list = keys.map(k => `<li>${escapeHTML(k)}</li>`).join('');

    $notification.post(
      "✅ 同步成功",
      `当前组 ${keys.length} 个商品`,
      `剩余 ${remainingGroups} 组`
    );

    renderUI(
      "✅ 当前组同步完成",
      `<p>本次已同步第 <b>${escapeHTML(payload.currentGroupIndex)}</b> 组，共 <b>${keys.length}</b> 个商品。</p>
       <p>同步后剩余 <b>${remainingGroups}</b> 组待处理。</p>
       <ul>${list}</ul>`,
      "success"
    );
  });
});
