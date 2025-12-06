// Surge 脚本：从特定URL中提取并更新 TempProductId

const key = "TempProductId";

// 获取已有 TempProductId 的值
const existingIds = $persistentStore.read(key);

// 从URL提取新的产品ID (仅匹配特定的 xbox 链接)
const url = $request.url;

// 改进正则表达式，匹配 store/ 后面的游戏ID（支持大小写）
const matches = url.match(/^https:\/\/www\.xbox\.com\/[eE][nN]-[uU][sS]\/games\/store\/[^\/]+\/([^\/?]+)/);

if (matches && matches[1]) {
    const newProductId = matches[1];

    // 将已有的 TempProductId 分割为数组
    const existingIdArray = existingIds ? existingIds.split("&") : [];

    if (!existingIdArray.includes(newProductId)) {
        // 如果已有内容不为空，则先加入 '&' 再追加新ID
        const finalProductId = existingIdArray.length > 0
            ? `${existingIdArray.join("&")}&${newProductId}`
            : newProductId;

        // 更新 TempProductId 的值
        $persistentStore.write(finalProductId, key);

        // 控制台输出操作
        console.log(`✅ 已更新 TempProductId: ${finalProductId}`);

        // 发送通知表示操作完成
        $notification.post("✅ 操作成功", "已更新 TempProductId", finalProductId);
    } else {
        console.log(`⚠️ TempProductId 未更新，已存在: ${newProductId}`);
        $notification.post("⚠️ 操作跳过", "TempProductId 已存在", newProductId);
    }
}

// 结束脚本
$done();