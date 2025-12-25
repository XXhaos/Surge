/**
 * Surge 脚本：微软家庭组批量购买 (POST Only + 并发 + 无人为超时)
 * * 修正：移除了 sendRequest 中的 5秒 强制超时。
 * * 逻辑：完全依赖 $httpClient 的回调，只要服务器返回 200 即视为成功。
 */

const STORE_KEY = "ApprovalCartId";

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
        "🚀 批量助手启动", 
        `捕获到主请求，后台准备处理 ${targetIds.length} 个任务`, 
        "请不要关闭页面，正在极速并发执行..."
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

    console.log(`🚀 [旁路并发] 正在后台处理 ${targetIds.length} 个请求...`);

    // 5. 并发请求生成器
    const tasks = targetIds.map((id, index) => {
        return new Promise(async (resolve) => {
            // 深拷贝并修改 CartId
            let currentBody = JSON.parse(JSON.stringify(originalBodyTemplate));
            currentBody.cartId = id;

            const options = {
                url: $request.url,
                method: "POST",
                headers: baseHeaders,
                body: JSON.stringify(currentBody)
            };

            // 发送请求 (等待真实响应)
            const result = await sendRequest(options);
            
            if (result.status === 200) {
                console.log(`✅ [${index + 1}] ${id} OK`);
                resolve({ success: true });
            } else {
                console.log(`❌ [${index + 1}] ${id} 失败 (Code: ${result.status})`);
                // 这里可以把 result.body 打印出来看看具体的错误原因
                resolve({ success: false });
            }
        });
    });

    // 6. 等待所有请求自然结束 (由 Surge 托管超时)
    const results = await Promise.all(tasks);

    // 7. 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    // 清空 Store
    $persistentStore.write(null, STORE_KEY);
    console.log(`🏁 后台处理完毕。成功: ${successCount}, 失败: ${failCount}`);

    if (failCount > 0) {
        $notification.post("⚠️ 批量执行完毕", `成功 ${successCount} | 失败 ${failCount}`, "当前主请求已放行");
    } else {
        $notification.post("✅ 批量执行完毕", `后台成功帮点 ${successCount} 个`, "当前主请求已放行");
    }

    // 8. 直接放行
    $done({});

})();

// ==========================================
// 工具函数：纯净版 sendRequest
// ==========================================
// 没有任何定时器，完全等待 $httpClient 的回调
function sendRequest(opts) {
    return new Promise((resolve) => {
        $httpClient.post(opts, (err, resp, data) => {
            if (err) {
                // 网络层面的错误（DNS失败、TCP中断等）
                console.log(`❌ 网络请求错误: ${err}`);
                resolve({ status: 0, error: err });
            } else {
                // 只要有 HTTP 状态码，就返回状态码
                // 哪怕是 500 或 400，也如实返回，由主逻辑判断
                resolve({ status: resp.status, body: data });
            }
        });
    });
}
