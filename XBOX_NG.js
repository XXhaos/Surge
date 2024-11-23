let body = $response.body;

if($request.url.includes("cart.production.store-web.dynamics.com/v1.0/cart/loadCart"))
{
    body = 
    `
    {"market": "NG","locale": "en-NG","friendlyName": "cart-NG"}
    `
}

$done({
    status: 200,
    body: body
});
