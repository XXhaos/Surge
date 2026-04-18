/**
 * Surge 脚本：捕获 cart 请求的 Authorization 和 cartId
 *
 * 功能：
 *   - 保持原有：始终在 $persistentStore 中维护最新的 authorization 和 cartId
 *   - 新增：把每次捕获追加到 cart_records 数组（cartId 去重）
 *
 * cart_records 结构：[{cartId, authorization, ts}, ...]
 *   - 匹配由网页脚本动态完成，本脚本不做任何配对
 */

const pattern = /^https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/Cart\/eligibilityCheck\?/;
const url = $request.url;

const MAX_RECORDS = 20;   // cart 记录保留最近 20 条

if ($request.method === "PUT" && pattern.test(url)) {
    try {
        const authorization = $request.headers['authorization'];
        const urlObj = new URL(url);
        const cartId = urlObj.searchParams.get('cartId');
        const now = Date.now();

        // 保留原有：维护最新二元组
        if (authorization && authorization !== $persistentStore.read("authorization")) {
            $persistentStore.write(authorization, "authorization");
            console.log(`Stored authorization: ${authorization}`);
        }
        if (cartId && cartId !== $persistentStore.read("cartId")) {
            $persistentStore.write(cartId, "cartId");
            console.log(`Stored cartId: ${cartId}`);
        }

        // 新增：追加到 cart_records（cartId 去重）
        if (cartId && authorization) {
            appendCartRecord({ cartId, authorization, ts: now });
        }

        $notification.post(
            "Surge 信息存储",
            "已捕获并存储 authorization 和 cartId"
        );
    } catch (error) {
        console.log(`Error capturing authorization & cartId: ${error}`);
        $notification.post(
            "Surge 脚本错误",
            "无法捕获 authorization 和 cartId",
            `${error}`
        );
    }
}

function appendCartRecord(entry) {
    let records = [];
    const raw = $persistentStore.read("cart_records");
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) records = parsed;
        } catch (e) { records = []; }
    }

    // 去重：相同 cartId 不重复记录
    if (records.some(r => r.cartId === entry.cartId)) {
        console.log(`[cart] SKIP: cartId=${entry.cartId} 已存在`);
        return;
    }

    records.push(entry);
    if (records.length > MAX_RECORDS) records = records.slice(-MAX_RECORDS);
    $persistentStore.write(JSON.stringify(records), "cart_records");

    console.log(`[cart] ✅ 已记录 cartId=${entry.cartId}, total=${records.length}`);
    $notification.post("Surge 历史记录", "已记录 cart 信息", "");
}

$done({});
