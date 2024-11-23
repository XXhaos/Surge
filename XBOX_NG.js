let body = $request.body;

// 使用正则替换特定的字段值
body = body.replace(/\"market\":\"[^\"]+\"/g, '\"market\":\"NG\"');
body = body.replace(/\"locale\":\"[^\"]+\"/g, '\"locale\":\"en-NG\"');
body = body.replace(/\"friendlyName\":\"[^\"]+\"/g, '\"friendlyName\":\"cart-NG\"');

$done({ body });
