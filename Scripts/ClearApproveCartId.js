// Surge 脚本：直接清空 ApproveCartId

const key = "ApproveCartId";

// 清空 TempProductId 的值
$persistentStore.write("", key);

// 控制台输出操作信息
console.log("✅ 操作成功 - 已清空 ApproveCartId");

// 发送通知表示操作完成
$notification.post("✅ 操作成功", "已清空 ApproveCartId", "");

// 结束脚本
$done();
