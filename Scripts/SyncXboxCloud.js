const workerUrl = 'https://ngaccountant.biubiubiu-lalala.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList'; 

$httpClient.get(workerUrl, (error, response, data) => {
    if (error || response.status !== 200) {
        $notification.post("❌ 同步失败", "无法连接 Worker", error || `状态码: ${response.status}`);
        return $done({ status: "HTTP/1.1 500 Error", body: "" });
    }

    try {
        const cloudData = JSON.parse(data);
        const count = Object.keys(cloudData).length;

        if (count === 0) {
            $notification.post("⚠️ 同步提醒", "云端暂无最新 Xbox 游戏数据", "请先在 Bot 运行 /run");
            return $done({ status: "HTTP/1.1 200 OK", body: "No Data" });
        }

        // 写入 Surge 存储
        if ($persistentStore.write(JSON.stringify(cloudData), storeKey)) {
            // 同步成功后清理云端，实现阅后即焚
            $httpClient.get(workerUrl + '&action=clear', () => {
                $notification.post("✅ 同步成功", `已同步 ${count} 个商品到 Surge`, "云端数据已自动清理");
                $done({ status: "HTTP/1.1 200 OK", body: "Success" });
            });
        } else {
            $notification.post("❌ 写入失败", "Surge 持久化存储空间错误", "");
            $done({ status: "HTTP/1.1 500 Error", body: "" });
        }
    } catch (e) {
        $done({ status: "HTTP/1.1 500 Error", body: "数据解析失败" });
    }
});
