// Surge脚本：拦截 RequestParentalApproval 并替换 CartId/Auth
// 增加了通知功能：成功或失败都会弹窗提示

// 1. 判断 HTTP 请求方法是否为 POST
if ($request.method !== "POST") {
  $done({});
} else {
  // 定义状态标记，用于最后发通知
  let status = { cartId: false, auth: false };
  let errorMsg = [];

  // 2. 读取持久化存储
  let newCartId = $persistentStore.read("cartId");
  let newAuth = $persistentStore.read("authorization");

  if (!newCartId) {
    console.log("警告：Store 中缺少 cartId");
    errorMsg.push("缺少 cartId");
  }
  if (!newAuth) {
    console.log("警告：Store 中缺少 authorization");
    errorMsg.push("缺少 Auth");
  }

  // 3. 解析并修改 Request Body (CartId)
  let bodyStr = $request.body || "";
  let bodyObj;
  try {
    bodyObj = JSON.parse(bodyStr);
  } catch (e) {
    console.log("JSON 解析失败：" + e);
    errorMsg.push("JSON 解析错误");
    bodyObj = null;
  }

  // 4. 执行替换：CartId
  if (bodyObj && newCartId) {
    bodyObj.cartId = newCartId;
    bodyStr = JSON.stringify(bodyObj);
    status.cartId = true; // 标记成功
  }

  // 5. 执行替换：Authorization
  let headers = $request.headers;
  if (newAuth) {
    let authHeaderKey = Object.keys(headers).find(k => k.toLowerCase() === "authorization");
    if (authHeaderKey) {
      headers[authHeaderKey] = newAuth;
    } else {
      headers["Authorization"] = newAuth;
    }
    status.auth = true; // 标记成功
  }

  // 6. 修正 Content-Length
  if (bodyStr !== $request.body) {
    let lenKey = Object.keys(headers).find(k => k.toLowerCase() === "content-length");
    if (lenKey) delete headers[lenKey];
  }

  // 7. 发送通知逻辑
  if (status.cartId && status.auth) {
    // 情况A：完美，两个都替换了
    $notification.post("✅ 替换成功", "Xbox 购买参数", "CartId 和 Authorization 均已更新");
  } else if (status.cartId || status.auth) {
    // 情况B：部分成功 (比如只有Auth没有CartId)
    let details = [];
    if (status.cartId) details.push("CartId OK");
    if (status.auth) details.push("Auth OK");
    $notification.post("⚠️ 部分替换成功", "Xbox 购买参数", `仅完成: ${details.join(", ")} (请检查参数)`);
  } else {
    // 情况C：完全失败
    let reason = errorMsg.length > 0 ? errorMsg.join(" & ") : "未知原因";
    $notification.post("❌ 替换失败", "Xbox 购买参数", reason);
  }

  // 8. 返回结果
  if (newAuth) {
    $done({ body: bodyStr, headers: headers });
  } else {
    $done({ body: bodyStr });
  }
}
