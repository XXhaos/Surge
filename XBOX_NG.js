let body = JSON.parse($response.body);

// 修改指定字段的值
body.market = "NG";
body.locale = "en-NG";
body.friendlyName = "cart-NG";

// 将修改后的对象转换回 JSON 字符串
let modifiedBody = JSON.stringify(body);

// 返回修改后的响应
$done({ body: modifiedBody });
