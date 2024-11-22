(function() {
  const version = 'V1.0.0';
  const market = 'NG';
  const locale = 'en-NG';
  const friendlyName = 'cart-NG';

  try {
    let body = JSON.parse($request.body);
    
    // 打印原始请求体用于调试
    console.log(`[${version}] Original Request Body:`, body);

    // 修改字段
    body.market = market;
    body.locale = locale;
    body.friendlyName = friendlyName;

    // 打印修改后的请求体用于调试
    console.log(`[${version}] Modified Request Body:`, body);

    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.error(`[${version}] Error modifying request body:`, error);
    $done({});
  }
})();
