/**
 * Surge 脚本：捕获 peoplehub 响应中的 gamertag
 *
 * 功能：
 *   - 保持原有：维护最新 gamertag 到 $persistentStore.gamertag
 *   - 新增：把每次捕获追加到 gamertag_records 数组（相邻相同值去重）
 *
 * gamertag_records 结构：[{gamertag, ts}, ...]
 *   - 匹配由网页脚本动态完成，本脚本不做任何配对
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

const MAX_RECORDS = 20;   // gamertag 记录保留最近 20 条

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

                // 追加到 gamertag_records
                appendGamertagRecord({ gamertag, ts: now });
            }
        } catch (error) {
            console.log(`Error (gamertag): ${error}`);
            $notification.post("Surge 脚本错误", "gamertag 捕获失败", `${error}`);
        }
    }
}

function appendGamertagRecord(entry) {
    let records = [];
    const raw = $persistentStore.read("gamertag_records");
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) records = parsed;
        } catch (e) { records = []; }
    }

    // 相邻去重：如果最后一条就是同一个 gamertag，只更新它的 ts，不新增
    // 这样反复刷新同账号不会产生大量冗余记录
    if (records.length > 0 && records[records.length - 1].gamertag === entry.gamertag) {
        records[records.length - 1].ts = entry.ts;
        $persistentStore.write(JSON.stringify(records), "gamertag_records");
        console.log(`[gamertag] 更新末条时间戳: ${entry.gamertag}`);
        return;
    }

    records.push(entry);
    if (records.length > MAX_RECORDS) records = records.slice(-MAX_RECORDS);
    $persistentStore.write(JSON.stringify(records), "gamertag_records");
    console.log(`[gamertag] ✅ 新增记录: ${entry.gamertag}, total=${records.length}`);
}

$done({});
