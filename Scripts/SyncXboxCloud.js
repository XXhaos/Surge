/**
 * Xbox Cloud Sync Dashboard
 * 逻辑：从 Worker 获取数据 -> 写入 Surge 存储 -> 清理云端 -> 返回网页 UI
 */

const workerUrl = 'https://ngaccountant.biubiubiu-lalala.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList';
const startTime = Date.now();

$httpClient.get(workerUrl, (error, response, data) => {
    let statusSteps = "";
    let finalContent = "";
    
    // 1. 检查连接状态
    if (error || response.status !== 200) {
        return renderUI("❌ 连接失败", `无法连接至云端 Worker: ${error || response.status}`, "error");
    }

    try {
        const cloudData = JSON.parse(data);
        const keys = Object.keys(cloudData);
        const count = keys.length;

        // 2. 检查数据空值
        if (count === 0) {
            return renderUI("⚠️ 云端为空", "目前没有待同步的游戏数据，请先在 Bot 中运行 /run", "warning");
        }

        // 3. 执行写入
        const writeSuccess = $persistentStore.write(JSON.stringify(cloudData), storeKey);
        
        if (writeSuccess) {
            // 4. 执行云端清理 (阅后即焚)
            $httpClient.get(workerUrl + '&action=clear', (err, res, d) => {
                const gamesList = keys.map(k => `<li>${k} (ID: ${cloudData[k].ProductId})</li>`).join('');
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                
                renderUI(
                    "✅ 同步完成", 
                    `<p>已成功从云端拉取 <b>${count}</b> 个商品至本地 Surge。</p>
                     <ul style="text-align:left; font-size:14px; color:#ccc; background:#222; padding:15px; border-radius:8px; list-style:none;">
                        ${gamesList}
                     </ul>
                     <p style="font-size:12px; color:#888;">耗时: ${duration}s | 云端队列已清理</p>`, 
                    "success"
                );
            });
        } else {
            renderUI("❌ 写入失败", "Surge 持久化存储空间写入错误", "error");
        }
    } catch (e) {
        renderUI("❌ 解析错误", "Worker 返回的数据格式无法识别", "error");
    }
});

// --- UI 渲染函数 ---
function renderUI(title, message, type) {
    const icon = type === "success" ? "✅" : (type === "warning" ? "⚠️" : "❌");
    const themeColor = type === "success" ? "#107C10" : (type === "warning" ? "#ffaa00" : "#e81123");
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xbox Sync Dashboard</title>
        <style>
            body { background: #111; color: white; font-family: 'Segoe UI', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
            .card { background: #1a1a1a; padding: 30px; border-radius: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 90%; border-top: 5px solid ${themeColor}; animation: slideUp 0.5s ease-out; }
            h1 { font-size: 24px; margin-bottom: 10px; color: ${themeColor}; }
            .message { color: #ddd; line-height: 1.6; margin-bottom: 20px; }
            .btn { background: ${themeColor}; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; transition: transform 0.2s; }
            .btn:active { transform: scale(0.95); }
            @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .loader { width: 50px; height: 50px; border: 5px solid #333; border-top: 5px solid #107C10; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>${icon} ${title}</h1>
            <div class="message">${message}</div>
            <button class="btn" onclick="window.close()">关闭窗口</button>
        </div>
    </body>
    </html>`;

    $done({
        status: "HTTP/1.1 200 OK",
        headers: { "Content-Type": "text/html; charset=utf-8" },
        body: html
    });
}
