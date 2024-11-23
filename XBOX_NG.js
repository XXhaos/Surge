let body = JSON.parse($request.body);

// 打印日志查看请求是否正确被捕获
console.log("Original Body:", JSON.stringify(body));

// 修改市场、地区等字段为尼日利亚
body.market = "NG";
body.locale = "en-NG";
body.friendlyName = "cart-NG";

// 打印修改后的body
console.log("Modified Body:", JSON.stringify(body));

$done({ body: JSON.stringify(body) });
