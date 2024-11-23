if($request.url.includes("dynamics.com")) {
    $done({ 
        response: {
            status: 200,
            body: `{"market": "NG","locale": "en-NG","friendlyName": "cart-NG"}`
        }
    });
} else {
    $done({});
}
