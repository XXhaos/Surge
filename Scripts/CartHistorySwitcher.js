/**
 * Xbox Cart History Switcher
 *
 * 功能：
 * 1. 访问 https://carthistory.com/ → 按时间戳最近邻匹配 cart 和 gamertag，展示卡片
 * 2. 点击切换 → 覆盖 $persistentStore 中的 cartId / authorization / gamertag
 *
 * 匹配策略（核心）：
 *   - 读取 cart_records 和 gamertag_records 两个数组
 *   - 对每条 cart，在 gamertag_records 中找时间戳绝对差最小的一条
 *   - 若最小差值超过 MATCH_WINDOW_MS，则该 cart 的 gamertag 显示为 "(未知)"
 *   - 不在存储里记录"已匹配的三元组"，每次页面刷新都重新计算
 */

const CART_KEY        = "cartId";
const AUTH_KEY        = "authorization";
const GAMERTAG_KEY    = "gamertag";
const CART_RECORDS    = "cart_records";
const GAMERTAG_RECORDS = "gamertag_records";

// 匹配窗口：cart 和 gamertag 时间差超过此值就认为无法配对
const MATCH_WINDOW_MS = 60000;  // 60 秒，按需调整

const url = $request.url;
const parsed = new URL(url);
const action = parsed.searchParams.get("action");
const indexStr = parsed.searchParams.get("index");

if (action === "apply" && indexStr !== null) {
    applySwitch(parseInt(indexStr, 10));
} else {
    showList();
}

// ==================== 读取 ====================
function readRecords(key) {
    const raw = $persistentStore.read(key);
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

// ==================== 最近邻匹配 ====================
function matchCartToGamertag(cart, gamertagRecords) {
    if (!gamertagRecords.length) return { gamertag: "(未知)", diff: null };

    let best = null;
    let bestDiff = Infinity;
    for (const g of gamertagRecords) {
        const diff = Math.abs(cart.ts - g.ts);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = g;
        }
    }

    if (bestDiff > MATCH_WINDOW_MS) {
        return { gamertag: "(未知)", diff: bestDiff };
    }
    return { gamertag: best.gamertag, diff: bestDiff };
}

// ==================== 工具函数 ====================
function formatTimestamp(ms) {
    try {
        const d = new Date(ms);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (e) {
        return String(ms);
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function respondHtml(body) {
    $done({
        response: {
            status: 200,
            headers: {
                "Content-Type": "text/html;charset=utf-8",
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Pragma": "no-cache"
            },
            body: body
        }
    });
}

// ==================== 展示列表 ====================
function showList() {
    const cartRecords = readRecords(CART_RECORDS);
    const gamertagRecords = readRecords(GAMERTAG_RECORDS);
    const currentCartId = $persistentStore.read(CART_KEY) || "";

    // 为每条 cart 动态匹配 gamertag，生成展示数据
    const display = cartRecords.map((cart, i) => {
        const match = matchCartToGamertag(cart, gamertagRecords);
        return {
            originalIndex: i,
            cartId: cart.cartId,
            authorization: cart.authorization,
            ts: cart.ts,
            gamertag: match.gamertag,
            matchDiff: match.diff
        };
    });

    // 倒序（最新在前）
    const reversed = [...display].reverse();

    const cards = reversed.map(d => {
        const isActive = d.cartId === currentCartId;
        const cardStyle = isActive
            ? 'border:2px solid #10b981; background:#f0fdf4;'
            : 'border:1px solid #e5e7eb; background:#fff;';
        const activeBadge = isActive
            ? '<span style="background:#10b981; color:#fff; padding:2px 8px; border-radius:4px; font-size:12px; margin-left:8px; vertical-align:middle;">当前激活</span>'
            : '';
        const button = isActive
            ? '<button disabled style="padding:8px 16px; background:#d1d5db; color:#6b7280; border:none; border-radius:6px; font-weight:bold; cursor:not-allowed;">已激活</button>'
            : `<a href="https://carthistory.com/?action=apply&index=${d.originalIndex}" style="text-decoration:none;"><button style="padding:8px 16px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">切换到此账号</button></a>`;

        return `
        <div style="${cardStyle} border-radius:8px; padding:16px; margin-bottom:12px;">
            <div style="font-size:18px; font-weight:bold; color:#111827;">
                ${escapeHtml(d.gamertag)}${activeBadge}
            </div>
            <div style="font-size:13px; color:#6b7280; margin:6px 0 12px 0;">
                ${escapeHtml(formatTimestamp(d.ts))}
            </div>
            ${button}
        </div>`;
    }).join('');

    const emptyHint = cartRecords.length === 0
        ? '<div style="text-align:center; color:#6b7280; padding:40px; background:#fff; border-radius:8px;">暂无 cart 记录</div>'
        : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cart History</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:20px; margin:0; background:#f3f4f6;">
<div style="max-width:600px; margin:0 auto;">
    <h2 style="margin:0 0 20px 0; color:#111827;">🛒 Cart 账号历史</h2>
    <div style="margin-bottom:12px; color:#6b7280; font-size:14px;">共 ${cartRecords.length} 条记录（最新在前）</div>
    ${cards}
    ${emptyHint}
</div>
</body>
</html>`;

    respondHtml(html);
}

// ==================== 执行切换 ====================
function applySwitch(index) {
    const cartRecords = readRecords(CART_RECORDS);
    const gamertagRecords = readRecords(GAMERTAG_RECORDS);

    if (!Number.isInteger(index) || index < 0 || index >= cartRecords.length) {
        return showError("无效的记录索引", `index=${index}, 记录数=${cartRecords.length}`);
    }

    const cart = cartRecords[index];
    if (!cart || !cart.cartId || !cart.authorization) {
        return showError("记录不完整", "该条记录缺少 cartId 或 authorization");
    }

    const match = matchCartToGamertag(cart, gamertagRecords);
    const gamertag = match.gamertag;

    // 覆盖 $persistentStore
    $persistentStore.write(cart.cartId, CART_KEY);
    $persistentStore.write(cart.authorization, AUTH_KEY);
    if (gamertag && gamertag !== "(未知)") {
        $persistentStore.write(gamertag, GAMERTAG_KEY);
    }

    $notification.post(
        "✅ 账号切换成功",
        `已切换到 ${gamertag}`,
        ""
    );

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>切换成功</title>
<meta http-equiv="refresh" content="1; url=https://carthistory.com/">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:20px; background:#f3f4f6;">
<div style="max-width:500px; margin:80px auto; background:#fff; border-radius:12px; padding:32px; text-align:center; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="font-size:48px; margin-bottom:16px;">✅</div>
    <div style="font-size:20px; font-weight:bold; color:#10b981; margin-bottom:8px;">切换成功</div>
    <div style="font-size:16px; color:#374151;">已切换到 <b>${escapeHtml(gamertag)}</b></div>
    <div style="font-size:13px; color:#6b7280; margin-top:16px;">1 秒后自动返回列表...</div>
</div>
</body>
</html>`;

    respondHtml(html);
}

// ==================== 错误页 ====================
function showError(title, detail) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>错误</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; padding:20px; background:#f3f4f6;">
<div style="max-width:500px; margin:80px auto; background:#fff; border-radius:12px; padding:32px; text-align:center;">
    <div style="font-size:48px; margin-bottom:16px;">❌</div>
    <div style="font-size:20px; font-weight:bold; color:#ef4444; margin-bottom:8px;">${escapeHtml(title)}</div>
    <div style="font-size:14px; color:#6b7280; margin-bottom:16px;">${escapeHtml(detail)}</div>
    <a href="https://carthistory.com/" style="color:#3b82f6;">返回列表</a>
</div>
</body>
</html>`;
    respondHtml(html);
}
