/*
 * CoreHalo Web Dump
 * 作用：访问 http://corehalo.dump/fetch 时，以网页形式显示捕获的链接并清空存储
 */

// 1. 读取数据
let raw = $persistentStore.read("corehalo_links") || "[]";
let list;
try {
  list = JSON.parse(raw);
  if (!Array.isArray(list)) list = [];
} catch (e) {
  list = [];
}

const count = list.length;

// 2. 发送通知 (保持原有的系统通知功能)
if (count > 0) {
  $notification.post("CoreHalo Dump", `捕获 ${count} 条链接`, "已在浏览器显示并清空");
} else {
  $notification.post("CoreHalo Dump", "没有新链接", "列表为空");
}

// 3. 准备 HTML 内容
// 生成列表项 HTML
const listHtml = list.map((link, index) => `
    <div class="item">
        <span class="index">${index + 1}.</span>
        <a href="${link}" target="_blank">${link}</a>
    </div>
`).join("");

// 页面样式
const css = `
<style>
    body { font-family: -apple-system, sans-serif; background-color: #f4f4f4; padding: 20px; display: flex; justify-content: center; }
    .card { background: white; width: 100%; max-width: 600px; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    h1 { margin-top: 0; font-size: 20px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .count-tag { background: #007aff; color: white; padding: 2px 8px; border-radius: 10px; font-size: 14px; margin-left: 8px; vertical-align: middle; }
    .empty-state { text-align: center; color: #999; padding: 40px 0; }
    .list-container { max-height: 70vh; overflow-y: auto; }
    .item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; display: flex; align-items: flex-start; word-break: break-all; }
    .item:last-child { border-bottom: none; }
    .index { color: #999; font-size: 12px; margin-right: 10px; min-width: 20px; margin-top: 2px; }
    a { color: #333; text-decoration: none; font-size: 13px; line-height: 1.4; transition: color 0.2s; }
    a:hover { color: #007aff; }
    .footer { margin-top: 15px; font-size: 12px; color: #aaa; text-align: center; }
</style>
`;

const bodyContent = count > 0 
    ? `<div class="list-container">${listHtml}</div>` 
    : `<div class="empty-state">📭 暂无捕获的链接</div>`;

const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CoreHalo Links</title>
    ${css}
</head>
<body>
    <div class="card">
        <h1>捕获列表 <span class="count-tag">${count}</span></h1>
        ${bodyContent}
        <div class="footer">列表已自动清空</div>
    </div>
</body>
</html>`;

// 4. 清空存储 (提取后即焚)
$persistentStore.write("[]", "corehalo_links");

// 5. 返回网页响应
$done({
  response: {
    status: 200,
    headers: { "Content-Type": "text/html;charset=utf-8" },
    body: html
  }
});
