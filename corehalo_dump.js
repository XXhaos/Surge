// corehalo_dump.js
// 作用：当访问 http://corehalo.dump/fetch 时
// 1. 读 persistentStore 里的链接数组
// 2. 弹通知告诉你这次拿了多少条
// 3. 直接在这个 http-request 阶段返回 JSON 响应给客户端
// 4. （可选）清空存储

// 读取已有列表
let raw = $persistentStore.read("corehalo_links") || "[]";
let list;
try {
  list = JSON.parse(raw);
  if (!Array.isArray(list)) {
    list = [];
  }
} catch (e) {
  list = [];
}

// 数量
let count = list.length;

// 通知一下，方便你确认 dump 被调用了
if (count > 0) {
  $notification.post(
    "CoreHalo Dump",
    "Count: " + count,
    list.join("\n")
  );
} else {
  $notification.post(
    "CoreHalo Dump",
    "Count: 0",
    "No links"
  );
}

// 准备要返回给 Safari / 快捷指令的 JSON 字符串
let bodyText = JSON.stringify(list);

// 清空（如果你不想清空，请把这一行注释掉）
$persistentStore.write("[]", "corehalo_links");

// 关键修正点：在 http-request 阶段用 response:{} 返回伪造的响应
$done({
  response: {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: bodyText
  }
});
