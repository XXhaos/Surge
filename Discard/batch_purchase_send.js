/**
 * Surge 脚本：微软家庭组批量购买 (防风控增强版)
 * * 特性 1: 随机抖动延迟 (1.5s ~ 3.5s 之间随机)，模拟真人。
 * * 特性 2: 智能熔断，遇到 429/403 立即停止，保护账号。
 */

const STORE_KEY = "ApprovalCartId";
const BASE_DELAY = 1500; // 基础间隔
const JITTER_MAX = 2000; // 最大随机附加间隔 (0~2000ms)

(async () => {
    // 1. 严格限制仅允许 POST
    if ($request.method !== "POST") {
        $done({});
        return;
    }

    // 2. 读取 Store
    const rawIds = $persistentStore.read(STORE_KEY);
    if (!rawIds) {
        console.log("ℹ️ [旁路] 未读取到 ApprovalCartId，放行。");
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
        "🛡️ 防风控批量启动", 
        `队列: ${targetIds.length} 个请求`, 
        `启用随机延迟与熔断保护机制...`
    );

    let originalBodyTemplate;
    try {
        originalBodyTemplate = JSON.parse($request.body);
    } catch (e) {
        $done({});
        return;
    }

    const baseHeaders = { ...$request.headers };
    delete baseHeaders["Content-Length"];
    delete baseHeaders["content-length"];

    let successCount = 0;
    let failCount = 0;
    let isBanned = false; // 标记是否被风控

    // ==========================================
    // 串行循环
    // ==========================================
    for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        
        // 构造请求
        let currentBody = JSON.parse(JSON.stringify(originalBodyTemplate));
        currentBody.cartId = id;

        const options = {
            url: $request.url,
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify(currentBody)
        };

        console.log(`🔄 [${i + 1}/${targetIds.length}] 处理 ${id.substring(0,6)}...`);
        
        const result = await sendRequest(options);

        // --- 结果判定与熔断逻辑 ---
        if (result && result.status >= 200 && result.status < 300) {
            console.log(`   ✅ 成功`);
            successCount++;
        } else if (result.status === 429 || result.status === 403) {
            // 429: Too Many Requests (请求太快)
            // 403: Forbidden (可能鉴权失败或被封禁)
            console.log(`   ⛔️ 触发风控 (Code: ${result.status})! 立即停止后续任务！`);
            $notification.post("⛔️ 任务熔断停止", `检测到微软风控 (${result.status})`, "已停止后续请求以保护账号");
            isBanned = true;
            failCount++;
            break; // 👈 核心：立即跳出循环，不再发包
        } else {
            console.log(`   ❌ 失败 (Code: ${result ? result.status : 'unknown'})`);
            failCount++;
        }

        // --- 随机抖动延迟 ---
        // 只有不是最后一个，且没有被Ban，才等待
        if (i < targetIds.length - 1 && !isBanned) {
            // 生成 1500ms 到 3500ms 之间的随机时间
            const randomTime = BASE_DELAY + Math.floor(Math.random() * JITTER_MAX);
            console.log(`   ⏳ 随机等待 ${(randomTime/1000).toFixed(2)}s...`);
            await sleep(randomTime);
        }
    }

    // 4. 清空 Store
    $persistentStore.write(null, STORE_KEY);

    // 5. 最终处理
    if (!isBanned) {
        const msg = `成功 ${successCount} | 失败 ${failCount}`;
        $notification.post("✅ 批量完成", msg, "原始请求已拦截，请刷新页面");
    }

    // 拦截并返回伪造成功
    $done({
        response: {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "Complete",
                message: "Processed by Surge (Anti-Ban Mode)"
            })
        }
    });

})();

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
