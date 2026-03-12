/**
 * SyncXboxCloud.js - 稳定 UI 版
 */

const workerUrl = 'https://ngaccountant.biubiubiu-lalala.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList';

// HTML 转义，避免特殊字符把页面撑坏
function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 统一结束页面输出
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
    :root {
      color-scheme: dark;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f1115;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
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
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    h1 {
      margin: 0 0 14px;
      font-size: 22px;
      line-height: 1.3;
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
      color: #dfe6f3;
    }
    .footer {
      margin-top: 18px;
      color: #8e99ab;
      font-size: 12px;
    }
    .btn-wrap {
      margin-top: 18px;
      display: flex;
      justify-content: center;
    }
    button {
      appearance: none;
      border: none;
      background: ${color};
      color: white;
      padding: 10px 22px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHTML(title)}</h1>
    <div class="msg">${message}</div>
    <div class="footer">Xbox Product Cloud Sync</div>
    <div class="btn-wrap">
      <button onclick="history.back()">确定</button>
    </div>
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

// 主逻辑
$httpClient.get(workerUrl, (error, response, data) => {
  if (error) {
    $notification.post("❌ 同步失败", "无法连接 Worker", String(error));
    return renderUI(
      "❌ 连接失败",
      `<p>无法连接至云端 Worker。</p><p>${escapeHTML(String(error))}</p>`,
      "error"
    );
  }

  let cloudData;
  try {
    const raw = (data || '').trim();
    cloudData = raw ? JSON.parse(raw) : {};
  } catch (e) {
    $notification.post("❌ 同步失败", "云端返回内容无法解析", "");
    return renderUI(
      "❌ 解析错误",
      `<p>Worker 返回的不是合法 JSON。</p><p>${escapeHTML(String(e.message || e))}</p>`,
      "error"
    );
  }

  if (!cloudData || typeof cloudData !== 'object' || Array.isArray(cloudData)) {
    $notification.post("❌ 同步失败", "云端数据结构异常", "");
    return renderUI(
      "❌ 数据异常",
      `<p>云端返回的数据不是正确的对象结构。</p>`,
      "error"
    );
  }

  const keys = Object.keys(cloudData);

  if (keys.length === 0) {
    $notification.post("⚠️ 同步提醒", "云端数据为空", "");
    return renderUI(
      "⚠️ 云端为空",
      `<p>目前没有待同步的游戏数据。</p>`,
      "warning"
    );
  }

  const writeOK = $persistentStore.write(JSON.stringify(cloudData), storeKey);

  if (!writeOK) {
    $notification.post("❌ 同步失败", "写入 Surge 持久化存储失败", "");
    return renderUI(
      "❌ 写入失败",
      `<p>Surge 持久化存储写入失败。</p><p>请检查存储空间或运行环境。</p>`,
      "error"
    );
  }

  // 写入成功后再尝试清云端
  $httpClient.get(workerUrl + '&action=clear', (clearError, clearResponse, clearData) => {
    const list = keys.map(k => `<li>${escapeHTML(k)}</li>`).join('');

    if (clearError) {
      $notification.post("⚠️ 部分成功", `已同步 ${keys.length} 个游戏`, "本地写入成功，但云端清理失败");
      return renderUI(
        "⚠️ 已同步，但云端未清理",
        `<p>本地已成功同步 <b>${keys.length}</b> 个游戏。</p>
         <p>但清理云端数据时失败，下次同步可能会重复读取。</p>
         <ul>${list}</ul>`,
        "warning"
      );
    }

    $notification.post("✅ 同步成功", `已同步 ${keys.length} 个游戏`, "");
    return renderUI(
      "✅ 同步完成",
      `<p>已成功同步 <b>${keys.length}</b> 个游戏到本地。</p>
       <p>同步清单如下：</p>
       <ul>${list}</ul>`,
      "success"
    );
  });
});
