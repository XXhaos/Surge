const modifyResponse = () => {
  if ($response && $response.body) {
    try {
      let body = JSON.parse($response.body);
      body.market = "NG";
      body.locale = "en-NG";
      body.friendlyName = "cart-NG";
      $done({ body: JSON.stringify(body) });
    } catch (error) {
      console.log("Error modifying response: ", error);
      $done({});
    }
  } else {
    $done({});
  }
};

modifyResponse();
