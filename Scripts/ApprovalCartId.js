/**
 * Surge 脚本：从 buynow 链接中提取 cartId 并存入 ApprovalCartId
 * 存储格式：id1&id2&id3...
 */

const key = "ApprovalCartId";

// 1. 获取已有 ApprovalCartId 的值
const existingRaw = $persistentStore.read(key);

// 2. 获取当前请求 URL
const url = $request.url;

// 3. 正则表达式提取 cartId
// 说明：[?&] 匹配开始的 ? 或中间的 &，cartId= 匹配参数名，([^&]+) 捕获直到下一个 & 或字符串结束的内容
const matches = url.match(/[?&]cartId=([^&]+)/);

if (matches && matches[1]) {
    const newCartId = matches[1];

    // 将已有的字符串分割为数组 (过滤掉空字符串，防止 split 产生 bug)
    let existingIdArray = existingRaw ? existingRaw.split("&").filter(Boolean) : [];

    // 4. 判重逻辑
    if (!existingIdArray.includes(newCartId)) {
        
        // 追加新 ID 到数组
        existingIdArray.push(newCartId);

        // 重新组合成字符串
        const finalString = existingIdArray.join("&");

        // 5. 写入 Persistent Store
        $persistentStore.write(finalString, key);

        // 控制台日志
        console.log(`✅ [CartId提取] 已追加: ${newCartId}`);
        console.log(`📄 当前列表: ${finalString}`);

        // 发送通知
        $notification.post(
            "✅ CartId 抓取成功", 
            `已存入第 ${existingIdArray.length} 个 ID`, 
            newCartId
        );
    } else {
        console.log(`⚠️ [CartId提取] 跳过，已存在: ${newCartId}`);
        // 如果需要重复时也弹窗，取消下面这行的注释
        // $notification.post("⚠️ 跳过重复 ID", "该 CartId 已在列表中", newCartId);
    }
} else {
    console.log("⚠️ URL 中未找到 cartId 参数");
}

// 结束脚本，继续请求
$done({});
