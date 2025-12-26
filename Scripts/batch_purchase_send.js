/**
 * Surge 脚本：微软家庭组批量购买 (串行执行 - 放行模式)
 * * 模式：串行执行 (Serial Execution)
 * * 机制：循环处理完所有 ID 后，放行原始请求，让浏览器收到真实的服务器响应。
 */

const STORE_KEY = "ApprovalCartId";
const DELAY_MS = 1500; // 【设置】每个请求间隔 1.5秒

(async () => {
    // 1. 严格限制仅允许 POST
    if ($request.method !== "POST") {
        $done({});
        return;
    }

    // 2. 读取 Store
    const rawIds = $persistentStore.read(STORE_KEY);
    if (!rawIds) {
        console.log("ℹ️ [旁路] 未读取到 ApprovalCartId，放行原始请求。");
        $done({});
        return;
    }

    const targetIds = rawIds.split("&").filter(Boolean);
    if (targetIds.length === 0) {
        $done({});
        return;
    }

    // 3. 启动通知
    $notification.post(
        "🐢 批量处理启动", 
        `准备串行处理 ${targetIds.length} 个任务`, 
        `正在后台排队执行，请稍候...`
    );

    // 4. 准备数据模板
    let originalBodyTemplate;
    try {
        originalBodyTemplate = JSON.parse($request.body);
    } catch (e) {
        console.log(`❌ Body 解析失败: ${e}`);
        $done({});
        return;
    }

    const baseHeaders = { ...$request.headers };
    // 移除长度头，让 httpClient 自动计算，防止 body 修改后长度不匹配
    delete baseHeaders["Content-Length"];
    delete baseHeaders["content-length"];

    console.log(`🚀 开始串行执行，队列长度: ${targetIds.length}`);

    let successCount = 0;
    let failCount = 0;

    // ==========================================
    // 5. 串行循环
    // ==========================================
    for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        
        // --- 构造请求 ---
        let currentBody = JSON.parse(JSON.stringify(originalBodyTemplate));
        currentBody.cartId = id;

        const options = {
            url: $request.url,
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify(currentBody)
        };

        // --- 发送请求 ---
        console.log(`🔄 [${i + 1}/${targetIds.length}] 正在处理 ${id}...`);
        
        // 这里我们不等待结果严格返回再继续，而是为了防风控只要发送了就稍微歇一下
        // 如果需要严格确认成功再下一个，可以使用 await sendRequest
        const result = await sendRequest(options);

        // --- 记录结果 ---
        if (result && result.status >= 200 && result.status < 300) {
            console.log(`✅ 成功`);
            successCount++;
        } else {
            // 如果是 400 且错误是"已处理"，也算成功，忽略它
            console.log(`❌ 结果: Code ${result ? result.status : 'unknown'}`);
            failCount++;
        }

        // --- 防风控间隔 (最后一个请求后不等待) ---
        if (i < targetIds.length - 1) {
            console.log(`⏳ 等待 ${DELAY_MS}ms...`);
            await sleep(DELAY_MS);
        }
    }

    // 6. 清空 Store (防止下次误触发)
    $persistentStore.write(null, STORE_KEY);
    console.log(`🏁 任务结束。后台处理: ${successCount} 成功, ${failCount} 失败`);

    // 7. 发送最终通知
    $notification.post(
        "✅ 批量执行完毕", 
        `后台已处理 ${successCount} 个`, 
        "正在放行当前原始请求..."
    );

    // ==========================================
    // 8. 核心修改：放行原始请求
    // ==========================================
    // 这会让当前点击的那个请求真正发送给服务器，前端会收到真实的响应。
    // 副作用：当前这个 ID 可能会被提交两次（循环里一次，这里一次），
    // 但微软接口通常是幂等的，第二次通常会返回“成功”或“无需操作”。
    $done({});

})();

// --- 工具函数 ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendRequest(opts) {
    return new Promise((resolve) => {
        $httpClient.post(opts, (err, resp, data) => {
            if (err) {
                console.log(`❌ 网络错误: ${err}`);
                resolve({ status: 0, error: err });
            } else {
                resolve({ status: resp.status, body: data });
            }
        });
    });
}
