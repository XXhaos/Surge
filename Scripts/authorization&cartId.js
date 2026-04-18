/**
 * Surge 脚本：捕获 cart 请求的 Authorization 和 cartId
 * 并在同一时刻根据最近捕获的 gamertag 写入 cartId_history
 *
 * 保留原有功能：
 *   - 始终在 $persistentStore 中维护最新的 authorization 和 cartId
 *
 * 历史记录逻辑：
 *   - 读取 gamertag_snapshot（由 gamertag 脚本写入，格式 {gamertag, ts}）
 *   - 若快照时间在 GAMERTAG_FRESHNESS_MS 窗口内 → 用它 + 本次 cartId/auth 写入历史
 *   - 若快照过旧或不存在 → 跳过，不写入（宁可漏记也不错记）
 *   - 相同 cartId 的记录不重复写入
 */

const pattern = /^https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/Cart\/eligibilityCheck\?/;
const url = $request.url;

// gamertag 快照"新鲜度"窗口：超出此时间认为不可信
const GAMERTAG_FRESHNESS_MS = 10000;  // 10 秒
const MAX_HISTORY = 10;

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

        // 尝试写入历史
        if (cartId && authorization) {
            tryAppendHistory(cartId, authorization, now);
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

function tryAppendHistory(cartId, authorization, now) {
    // 读取 gamertag 快照
    const raw = $persistentStore.read("gamertag_snapshot");
    if (!raw) {
        console.log(`[history] SKIP: gamertag 快照不存在（gamertag 脚本还没捕获过）`);
        return;
    }

    let snapshot;
    try {
        snapshot = JSON.parse(raw);
    } catch (e) {
        console.log(`[history] SKIP: gamertag 快照解析失败`);
        return;
    }

    const { gamertag, ts } = snapshot || {};
    if (!gamertag || !ts) {
        console.log(`[history] SKIP: gamertag 快照字段不完整`);
        return;
    }

    // 检查快照新鲜度
    const age = now - ts;
    console.log(`[history] gamertag 快照: ${gamertag}, 距今 ${age}ms`);

    if (age > GAMERTAG_FRESHNESS_MS) {
        console.log(`[history] SKIP: gamertag 快照过旧 (${age}ms > ${GAMERTAG_FRESHNESS_MS}ms)`);
        return;
    }
    if (age < 0) {
        console.log(`[history] SKIP: gamertag 快照时间异常（在未来）`);
        return;
    }

    // 读取历史
    let history = [];
    const histRaw = $persistentStore.read("cartId_history");
    if (histRaw) {
        try {
            const parsed = JSON.parse(histRaw);
            if (Array.isArray(parsed)) history = parsed;
        } catch (e) { history = []; }
    }

    // 去重：相同 cartId 不重复记录
    if (history.some(h => h.cartId === cartId)) {
        console.log(`[history] SKIP: cartId=${cartId} 已存在于历史中`);
        return;
    }

    const entry = {
        gamertag,
        cartId,
        authorization,
        timestamp: new Date().toISOString()
    };

    history.push(entry);
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), "cartId_history");

    console.log(`[history] ✅ 写入成功! gamertag=${gamertag}, cartId=${cartId}, total=${history.length}`);
    $notification.post(
        "Surge 历史记录",
        "新三元组已记入",
        `${gamertag}`
    );
}

$done({});
