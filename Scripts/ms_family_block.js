/**
 * 脚本名称: Microsoft Family ProductId Block
 * 功能: 拦截 Microsoft Family 中指定的 ProductId 购买请求
 */

// 定义需要拦截的目标 ID 列表
const targetIds = [
    "9PNTSH5SKCL5", "9nfmccp0pm67", "9npbvj8lwsvn", "9pcgszz8zpq2",
    "9P54FF0VQD7R", "9NCJZN3LBD3P", "9P9CLTVLLHD6", "9NHXDFLDBN6G"
];

function main() {
    // 1. 检查是否为 POST 请求 (对应 Fiddler 的 oSession.HTTPMethodIs("POST"))
    if ($request.method !== "POST") {
        $done({});
        return;
    }

    // 2. 获取请求体 (对应 oSession.GetRequestBodyAsString())
    // 注意：需要在模块配置中开启 requires-body=1
    const body = $request.body;

    if (!body) {
        $done({});
        return;
    }

    // 3. 检查是否包含目标 ID (对应 IndexOf + StringComparison.OrdinalIgnoreCase)
    // 为了实现忽略大小写匹配，我们将 body 和 targetId 都转换为大写进行比较
    const upperBody = body.toUpperCase();
    
    let isMatch = false;
    for (let id of targetIds) {
        if (upperBody.includes(id.toUpperCase())) {
            isMatch = true;
            break;
        }
    }

    // 4. 如果匹配，则拦截 (对应 oSession.oRequest.FailSession(403...))
    if (isMatch) {
        console.log(`[MS-Block] 检测到拦截目标，已阻断请求。`);
        $done({
            response: {
                status: 403,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8"
                },
                body: "Blocked by Surge script (Microsoft Family ProductId Rule)"
            }
        });
    } else {
        // 未匹配，放行
        $done({});
    }
}

main();
