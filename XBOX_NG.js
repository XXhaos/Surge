(function() {
  try {
    let body = JSON.parse($request.body);
    
    // 打印原始请求体用于调试
    console.log("Original Request Body:", body);

    // 修改 market 字段为尼日利亚
    body.market = "NG";
    // 修改 locale 字段为尼日利亚的英语
    body.locale = "en-NG";
    // 修改 friendlyName 字段以匹配尼日利亚市场
    body.friendlyName = "cart-NG";

    // 打印修改后的请求体用于调试
    console.log("Modified Request Body:", body);

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.error("Error modifying request body:", error);
    $done({});
  }
})();
