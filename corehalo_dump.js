// corehalo_dump.js
//
// 触发条件：访问 http://corehalo.local/fetch
// 返回值：当前存储在 $persistentStore["corehalo_links"] 的链接列表(JSON数组形式)
// 并清空列表 (可选)

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

// 序列化成 JSON 字符串作为响应体
let bodyText = JSON.stringify(list);

// 清空存储，避免重复 (如不想清空可注释掉下一行)
$persistentStore.write("[]", "corehalo_links");

// 返回 HTTP 响应
$done({
  status: "HTTP/1.1 200 OK",
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  },
  body: bodyText
});
