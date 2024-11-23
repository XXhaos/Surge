let body = JSON.parse($request.body);

// 修改为尼日利亚的字段
body.market = "NG";
body.locale = "en-NG";
body.friendlyName = "cart-NG";

// 返回修改后的请求体
$done({ body: JSON.stringify(body) });
