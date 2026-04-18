/**
 * Xbox Cart History Switcher
 * 远程路径: https://raw.githubusercontent.com/dragonisheep/Surge/refs/heads/master/Scripts/CartHistorySwitcher.js
 *
 * 功能：
 * 1. 访问 https://carthistory.com/ → 展示所有历史 gamertag 卡片列表
 * 2. 点击某条记录 → 访问 https://carthistory.com/?action=apply&index=N
 *    → 将该条的 cartId / authorization / gamertag 覆盖到 $persistentStore
 * 3. 切换后自动跳回列表页，当前激活的卡片会高亮显示
 */

const HISTORY_KEY  = "cartId_history";
const CART_KEY     = "cartId";
const AUTH_KEY     = "authorization";
const GAMERTAG_KEY = "gamertag";

const url = $request.url;
const parsed = new URL(url);
const action = parsed.searchParams.get("action");
const indexStr = parsed.searchParams.get("index");

if (action === "apply" && indexStr !== null) {
    applySwitch(parseInt(indexStr, 10));
} else {
    showList();
}

// ==================== 读取历史 ====================
function readHistory() {
    const raw = $persistentStore.read(HISTORY_KEY);
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

// ==================== 工具函数 ====================
function formatTimestamp(iso) {
    try {
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (e) {
        return iso;
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
    const history = readHistory();
    const currentCartId   = $persistentStore.read(CART_KEY) || "";
    const currentGamertag = $persistentStore.read(GAMERTAG_KEY) || "";

    // 倒序（最新在前），同时记录在原数组中的 index 用于切换
    const reversed = history.map((e, i) => ({ entry: e, originalIndex: i })).reverse();

    const cards = reversed.map(({ entry, originalIndex }) => {
        const isActive = entry.cartId === currentCartId;
        const cardStyle = isActive
            ? 'border:2px solid #10b981; background:#f0fdf4;'
            : 'border:1px solid #e5e7eb; background:#fff;';
        const activeBadge = isActive
            ? '<span style="background:#10b981; color:#fff; padding:2px 8px; border-radius:4px; font-size:12px; margin-left:8px; vertical-align:middle;">当前激活</span>'
            : '';
        const button = isActive
            ? '<button disabled style="padding:8px 16px; background:#d1d5db; color:#6b7280; border:none; border-radius:6px; font-weight:bold; cursor:not-allowed;">已激活</button>'
            : `<a href="https://carthistory.com/?action=apply&index=${originalIndex}" style="text-decoration:none;"><button style="padding:8px 16px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">切换到此账号</button></a>`;

        return `
        <div style="${cardStyle} border-radius:8px; padding:16px; margin-bottom:12px;">
            <div style="font-size:18px; font-weight:bold; color:#111827;">
                ${escapeHtml(entry.gamertag)}${activeBadge}
            </div>
            <div style="font-size:13px; color:#6b7280; margin:6px 0 12px 0;">
                ${escapeHtml(formatTimestamp(entry.timestamp))}
            </div>
            ${button}
        </div>`;
    }).join('');

    const emptyHint = history.length === 0
        ? '<div style="text-align:center; color:#6b7280; padding:40px; background:#fff; border-radius:8px;">暂无历史记录</div>'
        : '';

    const currentInfo = currentGamertag
        ? `<div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
               <div style="font-size:13px; color:#6b7280; margin-bottom:4px;">当前激活账号</div>
               <div style="font-size:16px; font-weight:bold; color:#1e40af;">${escapeHtml(currentGamertag)}</div>
           </div>`
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
    ${currentInfo}
    <div style="margin-bottom:12px; color:#6b7280; font-size:14px;">共 ${history.length} 条历史记录（最新在前）</div>
    ${cards}
    ${emptyHint}
</div>
</body>
</html>`;

    respondHtml(html);
}

// ==================== 执行切换 ====================
function applySwitch(index) {
    const history = readHistory();

    if (!Number.isInteger(index) || index < 0 || index >= history.length) {
        return showError("无效的记录索引", `index=${index}, 历史长度=${history.length}`);
    }

    const entry = history[index];
    if (!entry || !entry.cartId || !entry.authorization) {
        return showError("记录不完整", "该条记录缺少 cartId 或 authorization");
    }

    // 覆盖 persistentStore 中的当前值
    $persistentStore.write(entry.cartId, CART_KEY);
    $persistentStore.write(entry.authorization, AUTH_KEY);
    $persistentStore.write(entry.gamertag || "", GAMERTAG_KEY);

    $notification.post(
        "✅ 账号切换成功",
        `已切换到 ${entry.gamertag}`,
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
    <div style="font-size:16px; color:#374151;">已切换到 <b>${escapeHtml(entry.gamertag)}</b></div>
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
