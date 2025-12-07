// Surge脚本：拦截指定 URL (https://buynow.production.store-web.dynamics.com/v1.0/Cart/RequestParentalApproval?appId=BuyNow) 的 POST 请求，
// 将请求体内的 cartId 字段和请求头中的 Authorization 字段替换为保存在持久化存储中的对应值。
// （请在 Surge 配置中将此脚本设置为 http-request 类型，且 requires-body=true 以确保读取和修改请求体）

// 1. 判断 HTTP 请求方法是否为 POST，如非 POST 则直接放行不做任何修改
if ($request.method !== "POST") {
  $done({}); // 非 POST 请求，直接结束脚本，保持请求不变
} else {
  // 2. 从 Surge 的持久化存储中读取预先保存的 cartId 和 authorization 值
  let newCartId = $persistentStore.read("cartId");
  let newAuth = $persistentStore.read("authorization");

  // 如果未能获取到持久化存储的值，记录警告日志（需开启调试模式才能在请求笔记中查看）
  if (!newCartId) console.log("警告：未在持久化存储中找到 'cartId' 的值");
  if (!newAuth) console.log("警告：未在持久化存储中找到 'authorization' 的值");

  // 3. 获取请求体字符串，并尝试将其解析为 JSON 对象，方便我们修改其中字段
  let bodyStr = $request.body || "";  // 请求体的文本内容
  let bodyObj;
  try {
    bodyObj = JSON.parse(bodyStr);
  } catch (e) {
    // 如果解析失败（请求体可能不是合法的 JSON），打印错误日志并跳过请求体修改
    console.log("请求体 JSON 解析失败：" + e);
    bodyObj = null;
  }

  // 4. 将 JSON 对象中的 cartId 字段替换为持久化存储中的新 cartId 值（如果 bodyObj 存在且新值存在）
  if (bodyObj && newCartId) {
    bodyObj.cartId = newCartId;
    // 将修改后的 JSON 对象重新序列化为字符串，作为新的请求体
    bodyStr = JSON.stringify(bodyObj);
  }

  // 5. 修改请求头中的 Authorization 字段为持久化存储中的新 authorization 值（如果提供了新值）
  let headers = $request.headers;
  if (newAuth) {
    // 查找原请求头中是否存在 Authorization 字段（不区分大小写）
    let authHeaderKey = null;
    for (const key in headers) {
      if (key.toLowerCase() === "authorization") {
        authHeaderKey = key;
        break;
      }
    }
    if (authHeaderKey) {
      // 如果找到现有的 Authorization 字段，替换其值
      headers[authHeaderKey] = newAuth;
    } else {
      // 如果未找到，则添加 Authorization 字段
      headers["Authorization"] = newAuth;
    }
  }

  // 6. 如果请求体内容被修改过，删除可能存在的 Content-Length 请求头，让 Surge 自动计算新的内容长度
  if (bodyStr !== $request.body) {
    for (const key in headers) {
      if (key.toLowerCase() === "content-length") {
        delete headers[key]; // 移除旧的 Content-Length，Surge 将根据新请求体自动添加正确的 Content-Length
      }
    }
  }

  // 7. 使用 $done() 返回修改后的请求体和请求头。未提供的字段将保持原样。
  // 如果存在 newAuth（更改了请求头），则一并返回新的 headers；否则仅返回修改后的 body。
  if (newAuth) {
    $done({ body: bodyStr, headers: headers });
  } else {
    $done({ body: bodyStr });
  }
}
