/**
 * Surge 脚本：微软家庭组批量购买 (POST Only + 并发执行 + 启动通知 + 放行原请求)
 * * 限制：方法只允许 POST，其他方法直接忽略。
 * * 逻辑：启动通知 -> 并发后台请求 -> 结束通知 -> 放行主请求。
 */

const STORE_KEY = "ApprovalCartId";

(async () => {
    // ==========================================
    // 1. 【修改点】严格限制仅允许 POST
    // ==========================================
    if ($request.method !== "POST") {
        // 如果是 PUT 或 GET 等其他方法，直接结束脚本，不做任何处理
        $done({});
        return;
    }

    // 2. 读取 Store
    const rawIds = $persistentStore.read(STORE_KEY);
    // 如果没有 ID，直接放行
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
        "🚀 批量助手启动 (POST)", 
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

    // 移除 Content-Length
    const baseHeaders = { ...$request.headers };
    delete baseHeaders["Content-Length"];
    delete baseHeaders["content-length"];

    console.log(`🚀 [旁路并发] 正在后台处理 ${targetIds.length} 个请求...`);

    // 5. 并发请求生成器 (后台静默执行)
    const tasks = targetIds.map((id, index) => {
        return new Promise(async (resolve) => {
            // 深拷贝并修改 CartId
            let currentBody = JSON.parse(JSON.stringify(originalBodyTemplate));
            currentBody.cartId = id;

            const options = {
                url: $request.url,
                method: "POST", // 强制使用 POST
                headers: baseHeaders,
                body: JSON.stringify(currentBody)
            };

            // 发送请求
            const result = await sendRequest(options);
            
            if (result.status === 200) {
                console.log(`✅ [${index + 1}] ${id} OK`);
                resolve({ success: true });
            } else {
                console.log(`❌ [${index + 1}] ${id} Err: ${result.status}`);
                resolve({ success: false });
            }
        });
    });

    // 6. 等待所有后台任务完成
    const results = await Promise.all(tasks);

    // 7. 统计与结束通知
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

    // 8. 直接放行 ($done({}))
    $done({});

})();

// 封装请求函数 (5秒超时保护)
function sendRequest(opts) {
    return new Promise((resolve) => {
        const timeoutTimer = setTimeout(() => {
            resolve({ status: 504 });
        }, 5000);

        $httpClient.post(opts, (err, resp, data) => {
            clearTimeout(timeoutTimer);
            if (err) resolve({ status: 0, error: err });
            else resolve({ status: resp.status, body: data });
        });
    });
}
