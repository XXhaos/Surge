/**
 * Surge 脚本：捕获 cart 请求的 Authorization 和 cartId
 *
 * 功能：
 *   - 保持原有：始终在 $persistentStore 中维护最新的 authorization 和 cartId
 *   - 把每次捕获追加到 cart_records 数组（cartId 去重）
 */

const pattern = /^https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/Cart\/eligibilityCheck\?/;
const url = $request.url;

const MAX_RECORDS = 10;

if ($request.method === "PUT" && pattern.test(url)) {
    try {
        const authorization = $request.headers['authorization'];
        const urlObj = new URL(url);
        const cartId = urlObj.searchParams.get('cartId');
        const now = Date.now();

        if (authorization && authorization !== $persistentStore.read("authorization")) {
            $persistentStore.write(authorization, "authorization");
            console.log(`Stored authorization: ${authorization}`);
        }
        if (cartId && cartId !== $persistentStore.read("cartId")) {
            $persistentStore.write(cartId, "cartId");
            console.log(`Stored cartId: ${cartId}`);
        }

        if (cartId && authorization) {
            appendCartRecord({ cartId, authorization, ts: now });
        }

        // 保留原始的这条通知
        $notification.post(
            "Surge 信息存储",
            "已捕获并存储 authorization 和 cartId"
        );
    } catch (error) {
        console.log(`Error capturing authorization & cartId: ${error}`);
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

    if (records.some(r => r.cartId === entry.cartId)) {
        console.log(`[cart] SKIP: cartId=${entry.cartId} 已存在`);
        return;
    }

    records.push(entry);
    if (records.length > MAX_RECORDS) records = records.slice(-MAX_RECORDS);
    $persistentStore.write(JSON.stringify(records), "cart_records");

    console.log(`[cart] ✅ 已记录 cartId=${entry.cartId}, total=${records.length}`);
}

$done({});
