// corehalo_capture.js
//
// 触发：请求 URL 匹配 h5.m.goofish.com/...reminderUrl=...
// 逻辑：
//  1. 从 $request.url 提取 reminderUrl= 后的编码串
//  2. decodeURIComponent -> 真正目标链接 realLink
//  3. 保存到 persistentStore("corehalo_links")
//  4. 发通知，提示捕获到了什么

let reqUrl = $request && $request.url ? $request.url : "";

// 提取 reminderUrl= 后面的编码内容
let m = reqUrl.match(/reminderUrl=([^&]+)/);

if (m && m[1]) {
  // decode 出真实外链
  let realLink = decodeURIComponent(m[1]);

  // 从持久化存储读现有列表
  let raw = $persistentStore.read("corehalo_links") || "[]";
  let list;
  try {
    list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      list = [];
    }
  } catch (e) {
    list = [];
  }

  // 去重后推入
  let added = false;
  if (!list.includes(realLink)) {
    list.push(realLink);
    $persistentStore.write(JSON.stringify(list), "corehalo_links");
    added = true;
  }

  // 给你发一条通知，告诉你本次抓到的情况
  // 标题：CoreHalo Capture
  // 副标题：Added / Duplicate
  // 正文：具体链接
  $notification.post(
    "CoreHalo Capture",
    added ? "Added to list" : "Already in list",
    realLink
  );
}

// 放行原始请求
$done({});
