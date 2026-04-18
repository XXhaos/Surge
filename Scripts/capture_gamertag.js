/**
 * Surge 脚本：gamertag 捕获 + FIFO 配对写入 cartId_history
 *   - peoplehub 响应到达时捕获 gamertag
 *   - 若 pending_carts 有等候的 cart → 取最老一条配对
 *   - 否则把 gamertag 快照 push 进 pending_gamertags 等待
 *
 * Surge 配置：
 * [Script]
 * capture_gamertag = type=http-response, pattern=^https:\/\/peoplehub-public\.xboxlive\.com\/people\/gt\(.+\), requires-body=true, script-path=xxx.js
 *
 * [MITM]
 * hostname = %APPEND% peoplehub-public.xboxlive.com
 */

const peoplePattern = /^https:\/\/peoplehub-public\.xboxlive\.com\/people\/gt\(.+\)/;

const url = $request.url;
const now = Date.now();

const PAIR_WINDOW_MS = 30000;
const MAX_QUEUE = 20;
const MAX_HISTORY = 10;

if (peoplePattern.test(url)) {
    if (!$response.body) {
        console.log("peoplehub triggered but no response body, skip");
    } else {
        try {
            const body = JSON.parse($response.body);
            const gamertag = body && body.people && body.people[0] && body.people[0].gamertag;

            if (!gamertag) {
                console.log("[history] 响应中未找到 gamertag，跳过");
            } else {
                if (gamertag !== $persistentStore.read("gamertag")) {
                    $persistentStore.write(gamertag, "gamertag");
                    console.log(`Stored gamertag: ${gamertag}`);
                    $notification.post(
                        "Surge 信息存储",
                        "已捕获 gamertag",
                        `gamertag: ${gamertag}`
                    );
                }

                tryPairFromGamertag({ gamertag, ts: now });
            }
        } catch (error) {
            console.log(`Error (gamertag): ${error}`);
            $notification.post("Surge 脚本错误", "gamertag 捕获失败", `${error}`);
        }
    }
}

function tryPairFromGamertag(gtSnap) {
    let pendingCart = readQueue("pending_carts");
    pendingCart = pendingCart.filter(c => (now - c.ts) <= PAIR_WINDOW_MS);

    if (pendingCart.length > 0) {
        const cartSnap = pendingCart.shift();
        writeQueue("pending_carts", pendingCart);

        appendHistory({
            gamertag: gtSnap.gamertag,
            cartId: cartSnap.cartId,
            authorization: cartSnap.authorization,
            timestamp: new Date().toISOString()
        });

        console.log(`[history] ✅ gamertag 到达触发配对: gamertag=${gtSnap.gamertag}, cartId=${cartSnap.cartId}`);
        $notification.post("Surge 历史记录", "新三元组已记入", `${gtSnap.gamertag}`);
    } else {
        let pendingGT = readQueue("pending_gamertags");
        pendingGT = pendingGT.filter(g => (now - g.ts) <= PAIR_WINDOW_MS);
        pendingGT.push(gtSnap);
        if (pendingGT.length > MAX_QUEUE) pendingGT = pendingGT.slice(-MAX_QUEUE);
        writeQueue("pending_gamertags", pendingGT);

        console.log(`[history] gamertag 入队等待，当前 pending_gamertags 长度: ${pendingGT.length}`);
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

    // 去重：相同 cartId 的记录不重复写入
    if (history.some(h => h.cartId === entry.cartId)) {
        console.log(`[history] SKIP: cartId=${entry.cartId} 已存在于历史中`);
        return;
    }

    history.push(entry);
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), "cartId_history");
}

$done({});
