/**
 * Surge 脚本：微软家庭组批量购买 (执行后清空变量版)
 * * 逻辑变更：
 * 1. 依旧依次发送请求。
 * 2. 依旧会统计成功和失败的数量并弹窗通知。
 * 3. 【新】无论结果如何，脚本结束时直接清空 ApprovalCartId，不再保留失败任务。
 */

const STORE_KEY = "ApprovalCartId";

(async () => {
    // 1. 方法校验
    if ($request.method !== "POST") {
        $done({});
        return;
    }

    // 2. 读取 Store
    const rawIds = $persistentStore.read(STORE_KEY);
    if (!rawIds) {
        $notification.post("脚本中止", "未读取到 ApprovalCartId", "请先抓取 ID");
        $done({});
        return;
    }

    const targetIds = rawIds.split("&").filter(Boolean);
    if (targetIds.length === 0) {
        $notification.post("脚本中止", "任务列表为空", "");
        $done({});
        return;
    }

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

    console.log(`🚀 开始执行，共 ${targetIds.length} 个 CartID (执行完将清空列表)`);

    // 5. 循环发送
    for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        
        // --- 深拷贝 Body ---
        let currentBody = JSON.parse(JSON.stringify(originalBodyTemplate));
        currentBody.cartId = id; // 仅修改 ID

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

        await sleep(300); // 防并发拥堵
    }

    // ==========================================
    // 6. 核心修改：强制清空 Store
    // ==========================================
    
    // 无论成功失败，直接清空变量
    $persistentStore.write(null, STORE_KEY);
    console.log("🧹 已强制清空 ApprovalCartId 变量");

    // 7. 通知逻辑 (仅告知结果，不再回写)
    if (failedIds.length > 0) {
        $notification.post(
            "⚠️ 批量执行完毕 (变量已清空)", 
            `成功: ${successCount} | 失败: ${failedIds.length}`, 
            "失败的 ID 未保留，请注意查看日志"
        );
    } else {
        $notification.post(
            "✅ 批量执行完毕 (变量已清空)", 
            `共处理 ${successCount} 个请求`, 
            "所有任务均返回 HTTP 200"
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
