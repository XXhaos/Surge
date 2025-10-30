// corehalo_capture.js (DEBUG version just to reveal real host)

let reqUrl = $request && $request.url ? $request.url : "";
let host = "";
if ($request && $request.headers) {
  // Host 头里一般会是 TLS SNI 期望的域名 / HTTP层的主机
  host = $request.headers["Host"] || $request.headers["host"] || "";
}

// 每次触发先发一条DEBUG通知，看看真实的 Host 和 URL
$notification.post(
  "DEBUG capture host",
  host || "(no Host)",
  reqUrl
);

// =============== 原本的逻辑继续 ===============

let m = reqUrl.match(/reminderUrl=([^&]+)/);
if (m && m[1]) {
  let realLink = decodeURIComponent(m[1]);

  let raw = $persistentStore.read("corehalo_links") || "[]";
  let list;
  try {
    list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }

  if (!list.includes(realLink)) {
    list.push(realLink);
    $persistentStore.write(JSON.stringify(list), "corehalo_links");
  }

  // 可选：正常的“抓到了”通知
  $notification.post(
    "CoreHalo Capture",
    "Added",
    realLink
  );
}

$done({});
