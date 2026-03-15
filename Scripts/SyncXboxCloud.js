/**
 * SyncXboxCloud.js
 * 一次访问只同步当前第一组
 */

const workerUrl = 'https://cc.dragonisheep.com/surge?token=xbox123';
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
    .msg p {
      margin: 0 0 10px;
    }
    .msg ul {
      margin: 10px 0 0;
      padding-left: 20px;
      text-align: left;
    }
    .msg li {
      margin: 6px 0;
    }
    .sub {
      color: #8e99ab;
      font-size: 12px;
      margin-top: 14px;
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
    <div class="sub">SyncXbox Cloud Queue</div>
    <button onclick="history.back()">确定</button>
  </div>
</body>
</html>`;

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache"
      },
      body: html
    }
  });
}

// 只执行一次：读当前组 -> 写本地 -> clear当前组 -> 停止
$httpClient.get(workerUrl, (error, response, data) => {
  if (error) {
    $notification.post("❌ 同步失败", "无法连接 Worker", String(error));
    return renderUI(
      "❌ 连接失败",
      `<p>无法连接至云端 Worker。</p><p>${escapeHTML(String(error))}</p>`,
      "error"
    );
  }

  let payload;
  try {
    payload = JSON.parse((data || '').trim() || '{}');
  } catch (e) {
    $notification.post("❌ 同步失败", "返回 JSON 无法解析", "");
    return renderUI(
      "❌ 解析错误",
      `<p>Worker 返回内容不是合法 JSON。</p><p>${escapeHTML(String(e.message || e))}</p>`,
      "error"
    );
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    $notification.post("❌ 同步失败", "返回结构异常", "");
    return renderUI(
      "❌ 数据异常",
      `<p>Worker 返回的数据结构不正确。</p>`,
      "error"
    );
  }

  if (!payload.ok) {
    $notification.post("❌ 同步失败", "Worker 返回 ok=false", "");
    return renderUI(
      "❌ 同步失败",
      `<p>Worker 返回失败状态。</p>`,
      "error"
    );
  }

  const currentGroup = payload.currentGroup || {};
  const keys = Object.keys(currentGroup);

  // 当前没有可同步组
  if (!keys.length) {
    $notification.post("📭 当前无待同步组", "云端队列为空", "");
    return renderUI(
      "📭 没有可同步内容",
      `<p>当前没有待同步的 Product 分组。</p>`,
      "warning"
    );
  }

  // 只把当前这一组写入 Surge 本地
  const writeOK = $persistentStore.write(JSON.stringify(currentGroup), storeKey);

  if (!writeOK) {
    $notification.post("❌ 同步失败", "写入 Surge 存储失败", "");
    return renderUI(
      "❌ 写入失败",
      `<p>无法写入 Surge 本地存储。</p><p>请检查 Surge 运行环境或本地存储状态。</p>`,
      "error"
    );
  }

  // 本地写入成功后，只 clear 当前这一组
  $httpClient.get(workerUrl + '&action=clear', (clearError, clearResponse, clearData) => {
    if (clearError) {
      $notification.post(
        "⚠️ 本地已写入",
        `第 ${payload.currentGroupIndex} 组已保存`,
        "但云端清理失败，可能会重复读取当前组"
      );

      return renderUI(
        "⚠️ 当前组已写入，但云端未清理",
        `<p>已成功写入第 <b>${escapeHTML(payload.currentGroupIndex)}</b> 组，共 <b>${keys.length}</b> 个商品。</p>
         <p>但清理云端当前组时失败，下次访问时可能还是这一组。</p>`,
        "warning"
      );
    }

    let clearPayload = {};
    try {
      clearPayload = JSON.parse((clearData || '').trim() || '{}');
    } catch (_) {
      clearPayload = {};
    }

    const remainingGroups = typeof clearPayload.remainingGroups === 'number'
      ? clearPayload.remainingGroups
      : (typeof payload.remainingAfterCurrent === 'number' ? payload.remainingAfterCurrent : 0);

    const nextGroupIndex = clearPayload.nextGroupIndex ?? null;
    const nextGroupCount = clearPayload.nextGroupCount ?? 0;

    const list = keys.map(k => `<li>${escapeHTML(k)}</li>`).join('');

    let message =
      `<p>本次只同步了第 <b>${escapeHTML(payload.currentGroupIndex)}</b> 组，共 <b>${keys.length}</b> 个商品。</p>
       <p>当前这一组已经从云端队列删除。</p>
       <p>现在还剩 <b>${remainingGroups}</b> 组待处理。</p>`;

    if (remainingGroups > 0 && nextGroupIndex !== null) {
      message += `<p>下次访问网页时，将同步第 <b>${escapeHTML(nextGroupIndex)}</b> 组（共 <b>${escapeHTML(nextGroupCount)}</b> 个商品）。</p>`;
    } else {
      message += `<p>所有分组已经处理完毕。</p>`;
    }

    message += `<ul>${list}</ul>`;

    $notification.post(
      "✅ 当前组同步成功",
      `第 ${payload.currentGroupIndex} 组已同步`,
      `剩余 ${remainingGroups} 组`
    );

    return renderUI("✅ 当前组同步完成", message, "success");
  });
});
