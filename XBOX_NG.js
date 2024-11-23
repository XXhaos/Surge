let body = $response.body;

if ($request.url.match(/https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/cart\/loadCart.*/)) {
    // 将响应体解析为JSON对象
    let obj = JSON.parse(body);
    
    // 使用jq语法修改对象属性
    obj.market = "NG";
    obj.locale = "en-NG";
    obj.friendlyName = "cart-NG";
    
    // 将修改后的对象转回字符串
    body = JSON.stringify(obj);
}

$done({
    status: 200,
    body: body
});
