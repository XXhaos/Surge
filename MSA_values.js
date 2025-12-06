/**
 * Surge 脚本：捕获特定 URL 请求的 authorization、ms-cv、x-authorization-muid、x-ms-vector-id、x-ms-tracking-id、x-ms-reference-id、x-ms-correlation-id
 * 并存储到持久化存储（$persistentStore），只针对 POST 请求
 */

// 修改正则表达式，捕获新的请求 URL
const pattern = /^https:\/\/buynow\.production\.store-web\.dynamics\.com\/v1\.0\/Cart\/RequestParentalApproval\?appId=BuyNow/;
const url = $request.url;

// 判断是否是 POST 请求并且 URL 匹配
if ($request.method === "POST" && pattern.test(url)) {
    try {
        // 从请求头中获取所需的六个参数
        const msCv = $request.headers['ms-cv'];
        const xAuthorizationMuid = $request.headers['x-authorization-muid'];
        const xMsVectorId = $request.headers['x-ms-vector-id'];
        const xMsTrackingId = $request.headers['x-ms-tracking-id'];
        const xMsReferenceId = $request.headers['x-ms-reference-id'];
        const xMsCorrelationId = $request.headers['x-ms-correlation-id'];

        // 只有在成功捕获到新值时，才更新 $persistentStore 中的值
        if (msCv && msCv !== $persistentStore.read("ms-cv")) {
            $persistentStore.write(msCv, "ms-cv");
            console.log(`Stored ms-cv: ${msCv}`);
        }

        if (xAuthorizationMuid && xAuthorizationMuid !== $persistentStore.read("x-authorization-muid")) {
            $persistentStore.write(xAuthorizationMuid, "x-authorization-muid");
            console.log(`Stored x-authorization-muid: ${xAuthorizationMuid}`);
        }

        if (xMsVectorId && xMsVectorId !== $persistentStore.read("x-ms-vector-id")) {
            $persistentStore.write(xMsVectorId, "x-ms-vector-id");
            console.log(`Stored x-ms-vector-id: ${xMsVectorId}`);
        }

        if (xMsTrackingId && xMsTrackingId !== $persistentStore.read("x-ms-tracking-id")) {
            $persistentStore.write(xMsTrackingId, "x-ms-tracking-id");
            console.log(`Stored x-ms-tracking-id: ${xMsTrackingId}`);
        }

        if (xMsReferenceId && xMsReferenceId !== $persistentStore.read("x-ms-reference-id")) {
            $persistentStore.write(xMsReferenceId, "x-ms-reference-id");
            console.log(`Stored x-ms-reference-id: ${xMsReferenceId}`);
        }

        if (xMsCorrelationId && xMsCorrelationId !== $persistentStore.read("x-ms-correlation-id")) {
            $persistentStore.write(xMsCorrelationId, "x-ms-correlation-id");
            console.log(`Stored x-ms-correlation-id: ${xMsCorrelationId}`);
        }

        // 发送通知提示已成功捕获并存储参数
        $notification.post(
            "Surge 信息存储",
            "已捕获并存储购买请求所需参数"
        );
    } catch (error) {
        console.log(`Error capturing parameters: ${error}`);
        $notification.post(
            "Surge 脚本错误",
            "无法捕获所需参数",
            `${error}`
        );
    }
}

$done({});