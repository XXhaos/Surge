/*
 * Surge 脚本：清空 XboxProductList
 * 功能：1. 清空数据 2. 网页显示结果 3. 系统弹窗通知
 * 触发地址：http://clear_list.com
 */

const key = "XboxProductList";

// 1. 执行清空
$persistentStore.write("{}", key);

// 2. 控制台日志
console.log("✅ 操作成功 - 已清空 XboxProductList");

// 3. 【新增】发送系统通知 (这里是你想要弹窗的关键)
$notification.post("🗑️ 清单已清空", "操作成功", "XboxProductList 已重置为空对象");

// 4. 生成网页 HTML
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
        <p style="font-size:12px; color:#999; margin-top:10px;">(系统通知已发送)</p>
    </div>
</body>
</html>`;

// 5. 返回给浏览器
$done({
    response: {
        status: 200,
        headers: { "Content-Type": "text/html;charset=utf-8" },
        body: html
    }
});
