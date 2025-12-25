/**
 * Surge 脚本：微软家庭组批量购买 (串行防风控版 - 拦截模式)
 * * 模式：串行执行 (Serial Execution)
 * * 机制：脚本全权接管，循环处理完所有 ID 后，拦截原始请求并直接返回成功状态给前端。
 */

const STORE_KEY = "ApprovalCartId";
const DELAY_MS = 1500; // 【设置】每个请求间隔 1500毫秒

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
        "🐢 慢速防风控模式启动", 
        `准备串行处理 ${targetIds.length} 个任务`, 
        `全程接管请求，请保持页面打开...`
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
    // 移除长度头，让 httpClient 自动计算
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
        const result = await sendRequest(options);

        // --- 记录结果 ---
        if (result && result.status >= 200 && result.status < 300) {
            console.log(`✅ 成功`);
            successCount++;
        } else {
            console.log(`❌ 失败 (Code: ${result ? result.status : 'unknown'})`);
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
    console.log(`🏁 任务结束。成功: ${successCount}, 失败: ${failCount}`);

    // 7. 发送最终通知
    const statusMsg = failCount > 0 ? `成功 ${successCount} | 失败 ${failCount}` : `全部 ${successCount} 个成功`;
    $notification.post("✅ 批量处理完成", statusMsg, "原始请求已拦截，流程结束");

    // ==========================================
    // 8. 核心修改：拦截原始请求，返回伪造成功响应
    // ==========================================
    $done({
        response: {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "X-Script-By": "Surge-Batch-Processor"
            },
            // 返回一个看起来正常的空 JSON 或者微软风格的响应
            body: JSON.stringify({
                status: "Complete",
                message: "Processed by Surge script",
                totalProcessed: targetIds.length
            })
        }
    });

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
