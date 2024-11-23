let body = JSON.parse($request.body);

// 修改请求体的相应字段为尼日利亚
body.market = "NG";
body.locale = "en-NG";
body.friendlyName = "cart-NG";

// 将修改后的对象转换回字符串并返回
$done({body: JSON.stringify(body)});
