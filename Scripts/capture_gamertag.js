/**
 * Surge 脚本：捕获 peoplehub 响应中的 gamertag
 *
 * 功能：
 *   - 维护最新 gamertag 到 $persistentStore.gamertag
 *   - 每次捕获都追加到 gamertag_records 数组（不去重）
 */

const peoplePattern = /^https:\/\/peoplehub-public\.xboxlive\.com\/people\/gt\(.+\)/;
const url = $request.url;

const MAX_RECORDS = 30;    // tag 记录保留最近 30 条

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

                if (gamertag !== $persistentStore.read("gamertag")) {
                    $persistentStore.write(gamertag, "gamertag");
                    console.log(`Stored gamertag: ${gamertag}`);
                }

                appendGamertagRecord({ gamertag, ts: now });
            }
        } catch (error) {
            console.log(`Error (gamertag): ${error}`);
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

    records.push(entry);
    if (records.length > MAX_RECORDS) records = records.slice(-MAX_RECORDS);
    $persistentStore.write(JSON.stringify(records), "gamertag_records");
    console.log(`[gamertag] ✅ 新增记录: ${entry.gamertag}, total=${records.length}`);
}

$done({});
