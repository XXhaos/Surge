/**
 * SyncXboxCloud.js - 强力 UI 版
 */

const workerUrl = 'https://ngaccountant.biubiubiu-lalala.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList';

// 发起请求
$httpClient.get(workerUrl, (error, response, data) => {
    if (error) {
        // 如果连不上 Worker，立刻弹窗
        $notification.post("❌ 同步失败", "无法连接 Worker", error);
        return renderUI("❌ 连接失败", `无法连接至云端: ${error}`, "error");
    }

    try {
        const cloudData = JSON.parse(data);
        const keys = Object.keys(cloudData);

        if (keys.length === 0) {
            $notification.post("⚠️ 同步提醒", "云端数据为空", "");
            return renderUI("⚠️ 云端为空", "目前没有待同步的游戏数据", "warning");
        }

        // 写入 Surge 存储
        if ($persistentStore.write(JSON.stringify(cloudData), storeKey)) {
            // 写入成功后清理云端
            $httpClient.get(workerUrl + '&action=clear', () => {
                const list = keys.map(k => `<li>${k}</li>`).join('');
                $notification.post("✅ 同步成功", `已同步 ${keys.length} 个游戏`, "");
                renderUI("✅ 同步完成", `<p>同步清单：</p><ul style="text-align:left;">${list}</ul>`, "success");
            });
        } else {
            renderUI("❌ 写入失败", "Surge 存储空间异常", "error");
        }
    } catch (e) {
        renderUI("❌ 解析错误", "JSON 格式不正确", "error");
    }
});

function renderUI(title, message, type) {
    const color = type === "success" ? "#107C10" : "#d83b01";
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { background: #111; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1a1a1a; padding: 25px; border-radius: 12px; text-align: center; width: 85%; border-top: 5px solid ${color}; }
            h1 { color: ${color}; font-size: 20px; }
            .msg { color: #ccc; margin: 15px 0; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>${title}</h1>
            <div class="msg">${message}</div>
            <button style="background:${color};color:white;border:none;padding:10px 20px;border-radius:20px;" onclick="window.close()">确定</button>
        </div>
    </body>
    </html>`;

    $done({
        status: "HTTP/1.1 200 OK",
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html
    });
}
