let body = $request.body;

if ($request.url.includes("/v1.0/cart/loadCart")) {
    body = JSON.parse(body);

    // 修改请求体中的相关字段
    body.market = "NG";
    body.locale = "en-NG";
    body.friendlyName = "cart-NG";

    body = JSON.stringify(body);
}

$done({ body: body });
