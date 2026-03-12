/**
 * 逻辑：访问 https://syncxbox.com 触发
 * 1. 从 Worker 获取 JSON 数据
 * 2. 写入 Surge 的 PersistentStore (XboxProductList)
 * 3. 成功后指令 Worker 清理 KV 数据
 */

const workerUrl = 'https://你的Worker域名.workers.dev/?token=xbox123';
const storeKey = 'XboxProductList';

$httpClient.get(workerUrl, (error, response, data) => {
    if (error) {
      $notification.post("❌ 同步失败", "无法连接到 Cloudflare Worker", error);
      $done({ status: "HTTP/1.1 500 Internal Server Error", body: "Connect Worker Failed" });
      return;
    }

    if (response.status !== 200) {
      $notification.post("❌ 同步失败", "Worker 返回异常状态码", `Status: ${response.status}`);
      $done({ status: "HTTP/1.1 500 Internal Server Error", body: "Worker Error" });
      return;
    }

    try {
      const cloudData = JSON.parse(data);
      const count = Object.keys(cloudData).length;

      if (count === 0) {
        $notification.post("⚠️ 同步提醒", "云端暂无最新 Xbox 游戏数据", "请先在 Telegram 中运行抓取指令");
        $done({ status: "HTTP/1.1 200 OK", body: "No Data in Cloud" });
        return;
      }

      // 写入本地存储
      const success = $persistentStore.write(JSON.stringify(cloudData), storeKey);

      if (success) {
        // 关键步骤：同步成功后，通知云端清理数据（阅后即焚）
        $httpClient.get(workerUrl + '&action=clear', (err, res, d) => {
          $notification.post("✅ 同步成功", `已同步 ${count} 个商品到 Surge`, "云端数据已自动清理");
          $done({ 
            status: "HTTP/1.1 200 OK", 
            body: `<h1>Success</h1><p>Synced ${count} items. Cloud data cleared.</p>` 
          });
        });
      } else {
        $notification.post("❌ 写入失败", "Surge 存储空间异常", "请检查持久化存储状态");
        $done({ status: "HTTP/1.1 500 Error", body: "Write Store Failed" });
      }

    } catch (e) {
      $notification.post("❌ 解析错误", "Worker 返回的数据格式不正确", e.message);
      $done({ status: "HTTP/1.1 500 Error", body: "Parse Error" });
    }
});
