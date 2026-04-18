/**
 * Surge 脚本：仅捕获 peoplehub 响应中的 gamertag，存入 $persistentStore
 *
 * 两个用途：
 *   1. gamertag 这个 key：始终保持最新 gamertag（供其他脚本和 carthistory 页面使用）
 *   2. gamertag_snapshot 这个 key：{gamertag, ts} 格式，供 authorization&cartId.js
 *      在 cart 请求到达时用作历史记录的"当前 gamertag"依据
 *
 * 本脚本不再写入 cartId_history，也不再维护任何队列。
 *
 * Surge 配置：
 * [Script]
 * capture_gamertag = type=http-response, pattern=^https:\/\/peoplehub-public\.xboxlive\.com\/people\/gt\(.+\), requires-body=true, script-path=xxx.js
 *
 * [MITM]
 * hostname = %APPEND% peoplehub-public.xboxlive.com
 */

const peoplePattern = /^https:\/\/peoplehub-public\.xboxlive\.com\/people\/gt\(.+\)/;
const url = $request.url;

if (peoplePattern.test(url)) {
    if (!$response.body) {
        console.log("peoplehub triggered but no response body, skip");
    } else {
        try {
            const body = JSON.parse($response.body);
            const gamertag = body && body.people && body.people[0] && body.people[0].gamertag;

            if (!gamertag) {
                console.log("[gamertag] 响应中未找到 gamertag，跳过");
            } else {
                const now = Date.now();

                // 更新 gamertag 主 key（保持原有行为）
                if (gamertag !== $persistentStore.read("gamertag")) {
                    $persistentStore.write(gamertag, "gamertag");
                    console.log(`Stored gamertag: ${gamertag}`);
                    $notification.post(
                        "Surge 信息存储",
                        "已捕获 gamertag",
                        `gamertag: ${gamertag}`
                    );
                }

                // 更新快照（带时间戳），供 cart 脚本使用
                $persistentStore.write(JSON.stringify({
                    gamertag: gamertag,
                    ts: now
                }), "gamertag_snapshot");
                console.log(`[gamertag] 快照已更新: ${gamertag} @ ${now}`);
            }
        } catch (error) {
            console.log(`Error (gamertag): ${error}`);
            $notification.post("Surge 脚本错误", "gamertag 捕获失败", `${error}`);
        }
    }
}

$done({});
