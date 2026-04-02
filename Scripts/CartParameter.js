/**
 * Surge 脚本：捕获特定 URL 请求的参数
 * 包含: x-authorization-muid, ms-cv, x-ms-vector-id, x-ms-reference-id
 * 新增: x-ms-tracking-id, x-ms-correlation-id
 * 并存储到持久化存储（$persistentStore）中
 * 只针对 PUT 请求
 */

// 修改正则表达式，捕获新的请求 URL
const pattern = /^https:\/\/cart\.production\.store-web\.dynamics\.com\/v1\.0\/cart\/loadCart\?/;
const url = $request.url;

// 判断是否是 PUT 请求并且 URL 匹配
if ($request.method === "PUT" && pattern.test(url)) {
    try {
        // 从请求头中获取所需参数
        const xAuthorizationMuid = $request.headers['x-authorization-muid'];
        const msCv = $request.headers['ms-cv'];
        const xMsVectorId = $request.headers['x-ms-vector-id'];
        const xMsReferenceId = $request.headers['x-ms-reference-id'];
        // 新增参数获取
        const xMsTrackingId = $request.headers['x-ms-tracking-id'];
        const xMsCorrelationId = $request.headers['x-ms-correlation-id'];

        // 更新存储逻辑（仅在新值有效时更新）
        let hasUpdate = false;
        
        // 1. x-authorization-muid
        if (xAuthorizationMuid && xAuthorizationMuid !== $persistentStore.read("cart-x-authorization-muid")) {
            $persistentStore.write(xAuthorizationMuid, "cart-x-authorization-muid");
            console.log(`Stored x-authorization-muid: ${xAuthorizationMuid}`);
            hasUpdate = true;
        }

        // 2. ms-cv
        if (msCv && msCv !== $persistentStore.read("cart-ms-cv")) {
            $persistentStore.write(msCv, "cart-ms-cv");
            console.log(`Stored ms-cv: ${msCv}`);
            hasUpdate = true;
        }

        // 3. x-ms-vector-id
        if (xMsVectorId && xMsVectorId !== $persistentStore.read("cart-x-ms-vector-id")) {
            $persistentStore.write(xMsVectorId, "cart-x-ms-vector-id");
            console.log(`Stored x-ms-vector-id: ${xMsVectorId}`);
            hasUpdate = true;
        }

        // 4. x-ms-reference-id
        if (xMsReferenceId && xMsReferenceId !== $persistentStore.read("cart-x-ms-reference-id")) {
            $persistentStore.write(xMsReferenceId, "cart-x-ms-reference-id");
            console.log(`Stored x-ms-reference-id: ${xMsReferenceId}`);
            hasUpdate = true;
        }

        // 5. [新增] x-ms-tracking-id
        if (xMsTrackingId && xMsTrackingId !== $persistentStore.read("cart-x-ms-tracking-id")) {
            $persistentStore.write(xMsTrackingId, "cart-x-ms-tracking-id");
            console.log(`Stored x-ms-tracking-id: ${xMsTrackingId}`);
            hasUpdate = true;
        }

        // 6. [新增] x-ms-correlation-id
        if (xMsCorrelationId && xMsCorrelationId !== $persistentStore.read("cart-x-ms-correlation-id")) {
            $persistentStore.write(xMsCorrelationId, "cart-x-ms-correlation-id");
            console.log(`Stored x-ms-correlation-id: ${xMsCorrelationId}`);
            hasUpdate = true;
        }

        // 仅在成功捕获新值时发送通知（如果需要开启通知，取消下方注释）
        // if (hasUpdate) {
        //     $notification.post(
        //         "Surge 信息存储",
        //         "已捕获并存储所有加购请求参数",
        //         "包含 tracking-id 和 correlation-id"
        //     );
        // }

    } catch (error) {
        console.log(`Error capturing parameters: ${error}`);
        // $notification.post(
        //     "Surge 脚本错误",
        //     "无法捕获所需购物车参数",
        //     `${error}`
        // );
    }
}

$done({});
