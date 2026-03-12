const workerUrl = 'https://ngaccountant.biubiubiu-lalala.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList';

$httpClient.get(workerUrl, (error, response, data) => {
    if (error || response.status !== 200) {
        $notification.post("❌ Xbox 同步失败", "连接 Worker 异常", error || response.status);
        $done({ status: "HTTP/1.1 500 Error" });
        return;
    }
    try {
        const cloudData = JSON.parse(data);
        const count = Object.keys(cloudData).length;
        if (count === 0) {
            $notification.post("⚠️ 同步提醒", "云端无数据", "请先在 Bot 中 /run");
            $done({ status: "HTTP/1.1 200 OK" });
            return;
        }
        if ($persistentStore.write(JSON.stringify(cloudData), storeKey)) {
            $httpClient.get(workerUrl + '&action=clear', () => {
                $notification.post("✅ Xbox 同步成功", `已拉取 ${count} 个商品`, "云端已清空");
                $done({ status: "HTTP/1.1 200 OK", body: "Success" });
            });
        }
    } catch (e) { $done({ status: "HTTP/1.1 500 Error" }); }
});
