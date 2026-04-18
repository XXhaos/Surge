/**
 * Surge 脚本：捕获 cart 请求的 Authorization 和 cartId
 *   - 保留原有功能：始终在 $persistentStore 中维护最新的 authorization 和 cartId
 *   - 新增功能：FIFO 配对写入 cartId_history
 *       · 若 pending_gamertags 有等候的 gamertag → 取最老一条配对
 *       · 否则把 cart 快照 push 进 pending_carts 等待
 */

const pattern = /^https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/Cart\/eligibilityCheck\?/;
const url = $request.url;

const PAIR_WINDOW_MS = 30000;
const MAX_QUEUE = 20;
const MAX_HISTORY = 100;

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
            tryPairFromCart({ cartId, authorization, ts: now });
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

function tryPairFromCart(cartSnap) {
    const now = cartSnap.ts;

    let pendingGT = readQueue("pending_gamertags");
    pendingGT = pendingGT.filter(g => (now - g.ts) <= PAIR_WINDOW_MS);

    if (pendingGT.length > 0) {
        const gtSnap = pendingGT.shift();
        writeQueue("pending_gamertags", pendingGT);

        appendHistory({
            gamertag: gtSnap.gamertag,
            cartId: cartSnap.cartId,
            authorization: cartSnap.authorization,
            timestamp: new Date().toISOString()
        });

        console.log(`[history] ✅ cart 到达触发配对: gamertag=${gtSnap.gamertag}, cartId=${cartSnap.cartId}`);
        $notification.post("Surge 历史记录", "新三元组已记入", `${gtSnap.gamertag}`);
    } else {
        let pendingCart = readQueue("pending_carts");
        pendingCart = pendingCart.filter(c => (now - c.ts) <= PAIR_WINDOW_MS);
        pendingCart.push(cartSnap);
        if (pendingCart.length > MAX_QUEUE) pendingCart = pendingCart.slice(-MAX_QUEUE);
        writeQueue("pending_carts", pendingCart);

        console.log(`[history] cart 入队等待，当前 pending_carts 长度: ${pendingCart.length}`);
    }
}

function readQueue(key) {
    const raw = $persistentStore.read(key);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
}

function writeQueue(key, arr) {
    $persistentStore.write(JSON.stringify(arr), key);
}

function appendHistory(entry) {
    let history = [];
    const raw = $persistentStore.read("cartId_history");
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) history = parsed;
        } catch (e) { history = []; }
    }
    history.push(entry);
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), "cartId_history");
}

$done({});
