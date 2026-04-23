/**
 * Surge 脚本：Clear_ApprovalCartId.js
 * 作用：监测到 Family Safety 的 Complete 请求时，自动清空 ApprovalCartId
 */

const STORE_KEY = "ApprovalCartId";

(function() {
    // 只有 POST 方法才触发清理
    if ($request.method === "POST") {
        const oldValue = $persistentStore.read(STORE_KEY);
        
        if (oldValue) {
            $persistentStore.write("", STORE_KEY);
            
            console.log("🧹 [Batch Approve] 购买流程结束，已自动清空 ApprovalCartId 缓存。");
            
            $notification.post("Microsoft Family", "购买流程结束", "ApprovalCartId 缓存已清空");
        }
    }
    $done({});
})();
