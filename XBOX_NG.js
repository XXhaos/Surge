(function() {
  let body = JSON.parse($request.body);
  body.market = "NG";
  body.locale = "en-NG";
  body.friendlyName = "cart-NG";
  $done({ body: JSON.stringify(body) });
})();
