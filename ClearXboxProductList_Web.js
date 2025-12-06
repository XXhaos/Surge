/*
 * Surge 脚本：清空 XboxProductList 并返回网页提示
 * 触发地址：http://clear_list.com
 */

const key = "XboxProductList";

// 清空数据 (写入空对象字符串 "{}" 比空字符串 "" 更安全，防止 JSON 解析报错)
$persistentStore.write("{}", key);

// 控制台日志
console.log("✅ 操作成功 - 已清空 XboxProductList");

// 生成 HTML 响应
const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Clear List</title>
    <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f4f4f4; }
        .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center; }
        h1 { color: #28a745; margin: 0 0 10px; }
        p { color: #555; margin: 0; }
    </style>
</head>
<body>
    <div class="card">
        <h1>✅ 操作成功</h1>
        <p>XboxProductList 已被清空</p>
    </div>
</body>
</html>`;

// 返回网页结果
$done({
    response: {
        status: 200,
        headers: { "Content-Type": "text/html;charset=utf-8" },
        body: html
    }
});
