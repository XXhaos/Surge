/**
 * Surge 脚本：微软家庭组批量购买 (静默防抖版)
 * * 修复问题：解决因前端重试导致的“先成功后报错”的双重通知问题。
 * * 逻辑变更：当未读取到 ID 时，不再弹窗打扰，仅后台记录日志。
 */

const STORE_KEY = "ApprovalCartId";

(async () => {
    // 1. 方法校验
    if (method !== "POST" && method !== "PUT") {
        $done({});
        return;
    }

    // 2. 读取 Store
    const rawIds = $persistentStore.read(STORE_KEY);
    
    // 【修改点】如果读不到 ID，说明可能是重复请求或已执行完毕，直接静默退出
    if (!rawIds) {
        console.log("ℹ️ [防抖] 未读取到 ApprovalCartId，可能是重复请求或任务已清空，脚本跳过。");
        $done({});
        return;
    }

    const targetIds = rawIds.split("&").filter(Boolean);
    if (targetIds.length === 0) {
        console.log("ℹ️ [防抖] 任务列表解析为空，脚本跳过。");
        $done({});
        return;
    }

    $notification.post("▶️ 开始批量处理", `捕获到请求，准备执行 ${targetIds.length} 个任务`, "请稍候...");

    // 3. 解析原始 Body (作为只读模板)
    let originalBodyTemplate = null;
    try {
        originalBodyTemplate = JSON.parse($request.body);
    } catch (e) {
        console.log(`❌ Body 解析失败: ${e}`);
        $done({});
        return;
    }

    // 4. 复制原始 Headers (仅移除 Content-Length)
    const baseHeaders = { ...$request.headers };
    delete baseHeaders["Content-Length"];
    delete baseHeaders["content-length"];

    let failedIds = [];
    let successCount = 0;

    console.log(`🚀 开始执行，共 ${targetIds.length} 个 CartID`);

    // 5. 循环发送
    for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        
        let currentBody = JSON.parse(JSON.stringify(originalBodyTemplate));
        currentBody.cartId = id; 

        const options = {
            url: $request.url,
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify(currentBody)
        };

        const result = await sendRequest(options);
        
        if (result.status === 200) {
            console.log(`✅ [${i+1}] ${id} 成功`);
            successCount++;
        } else {
            console.log(`❌ [${i+1}] ${id} 失败 (Code: ${result.status})`);
            failedIds.push(id);
        }

        await sleep(300); 
    }

    // 6. 强制清空 Store
    $persistentStore.write(null, STORE_KEY);
    console.log("🧹 已强制清空 ApprovalCartId 变量");

    // 7. 通知逻辑
    if (failedIds.length > 0) {
        $notification.post(
            "⚠️ 批量执行完毕", 
            `成功: ${successCount} | 失败: ${failedIds.length}`, 
            "变量已清空，失败任务未保留"
        );
    } else {
        $notification.post(
            "✅ 批量执行完毕", 
            `共处理 ${successCount} 个请求`, 
            "变量已清空，流程结束"
        );
    }

    // 8. 响应前端
    $done({
        response: {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "BatchComplete", count: targetIds.length })
        }
    });

})();

// 工具函数
function sendRequest(opts) {
    return new Promise((resolve) => {
        $httpClient.post(opts, (err, resp, data) => {
            if (err) resolve({ status: 0, error: err });
            else resolve({ status: resp.status, body: data });
        });
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
