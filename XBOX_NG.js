(function() {
  // 解析请求体为 JSON
  let body = JSON.parse($request.body);

  // 修改 JSON 数据
  body.market = "NG";
  body.locale = "en-NG";
  body.friendlyName = "cart-NG";

  // 返回修改后的请求体
  $done({ body: JSON.stringify(body) });
})();
