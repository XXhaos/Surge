// corehalo_capture.js
//
// 触发条件：请求 URL 匹配  h5.m.goofish.com/...reminderUrl=...
// 目标：把 reminderUrl= 后面编码过的真实目标链接 decode 出来
//      然后 append 到 $persistentStore["corehalo_links"]

let reqUrl = $request && $request.url ? $request.url : "";

// 提取 reminderUrl= 后面的编码值
// 比如 ...reminderUrl=https%3A%2F%2Fapp.corehalo.com%2Fms%2Flink%2Fgo%3Fid%3D69098%26r%3Den-ng&titleVisible=false
let m = reqUrl.match(/reminderUrl=([^&]+)/);

if (m && m[1]) {
  // decode 成真正要打开的外链
  let realLink = decodeURIComponent(m[1]);

  // 读取已有列表
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

  // 去重后追加
  if (!list.includes(realLink)) {
    list.push(realLink);
  }

  // 写回持久化存储
  $persistentStore.write(JSON.stringify(list), "corehalo_links");
}

// 放行请求，不做拦截修改
$done({});
