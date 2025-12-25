/**
 * Surge 脚本：微软家庭组批量购买 (串行防风控版)
 * * 模式：串行执行 (Serial Execution)
 * * 策略：每处理完一个请求，强制休息 1.5 秒，模拟真人操作频率，避免触发微软风控。
 */

const STORE_KEY = "ApprovalCartId";
const DELAY_MS = 1500; // 【设置】每个请求间隔 1500毫秒 (1.5秒)

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

    // 3. 启动通知 (提示用户这会比较慢)
    $notification.post(
        "🐢 慢速防风控模式启动", 
        `准备串行处理 ${targetIds.length} 个任务`, 
        `为防风控，每个间隔 ${DELAY_MS/1000} 秒，请耐心等待...`
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
    delete baseHeaders["Content-Length"];
    delete baseHeaders["content-length"];

    console.log(`🚀 开始串行执行，队列长度: ${targetIds.length}`);

    let successCount = 0;
    let failCount = 0;

    // ==========================================
    // 5. 串行循环 (核心修改)
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

        // --- 发送请求并等待结果 ---
        console.log(`🔄 [${i + 1}/${targetIds.length}] 正在处理 ${id}...`);
        const result = await sendRequest(options);

        // --- 记录结果 ---
        if (result.status === 200) {
            console.log(`✅ 成功`);
            successCount++;
        } else {
            console.log(`❌ 失败 (Code: ${result.status})`);
            failCount++;
        }

        // --- 防风控间隔 (如果是最后一个就不睡了) ---
        if (i < targetIds.length - 1) {
            console.log(`⏳ 等待 ${DELAY_MS}ms...`);
            await sleep(DELAY_MS);
        }
    }

    // 6. 清空 Store
    $persistentStore.write(null, STORE_KEY);
    console.log(`🏁 所有任务执行完毕。成功: ${successCount}, 失败: ${failCount}`);

    // 7. 结束通知
    if (failCount > 0) {
        $notification.post("⚠️ 批量执行完毕", `成功 ${successCount} | 失败 ${failCount}`, "当前主请求已放行");
    } else {
        $notification.post("✅ 批量执行完毕", `已稳定处理 ${successCount} 个请求`, "当前主请求已放行");
    }

    // 8. 直接放行主请求
    $done({});

})();

// 工具函数：延时器
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 工具函数：网络请求 (纯净版，无超时限制)
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
