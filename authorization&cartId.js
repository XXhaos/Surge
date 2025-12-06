/**
 * Surge 脚本：捕获特定 URL 请求的 Authorization 和 cartId（仅限 PUT 请求）
 * 并存储到持久化存储（$persistentStore），只有在成功捕获到新值时才更新
 */

const pattern = /^https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/Cart\/eligibilityCheck\?/;
const url = $request.url;

// 仅处理 PUT 请求
if ($request.method === "PUT" && pattern.test(url)) {
    try {
        // 获取 Authorization 请求头的值
        const authorization = $request.headers['authorization'];
        // 解析 URL 以提取 cartId 参数
        const urlObj = new URL(url);
        const cartId = urlObj.searchParams.get('cartId');

        // 只有在成功捕获到新值时，才更新 $persistentStore 中的值
        if (authorization && authorization !== $persistentStore.read("authorization")) {
            $persistentStore.write(authorization, "authorization");
            console.log(`Stored authorization: ${authorization}`);
        }

        if (cartId && cartId !== $persistentStore.read("cartId")) {
            $persistentStore.write(cartId, "cartId");
            console.log(`Stored cartId: ${cartId}`);
        }

        // 发送通知，成功捕获并存储 Authorization 和 CartId
        $notification.post(
            "Surge 信息存储",
            "已捕获并存储 authorization 和 cartId"
        );
    } catch (error) {
        console.log(`Error capturing authorization & cartId: ${error}`);
        $notification.post(
            "Surge 脚本错误",
            "无法捕获 authorization 和 cartId",
            `${error}`
        );
    }
}

$done({});