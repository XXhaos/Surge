/**
 * NodeSeek 自动签到脚本（安全加固版）
 * ============================================================
 * 基于 Sliverkiss 原版重构，主要改进：
 *   1. 域名白名单 + 强制 HTTPS：防止脚本被篡改后请求其他域名
 *   2. Cookie/Token 日志脱敏：debug 与通知中自动打码
 *   3. 自动重试 + 超时控制：网络抖动不直接失败
 *   4. 配置项集中：所有可调参数在文件顶部 CONFIG
 *   5. 错误信息净化：异常只输出 message，避免打印内部对象
 *   6. 多账号间隔：防风控
 *   7. 主逻辑重写：去除 minified，便于自审
 *   8. Env.js 保留原样（chavyleung 标准库，自改反而引入风险）
 *
 * 支持平台：Surge / Loon / Stash / Shadowrocket / Quantumult X / Node.js
 *
 * 使用方式：
 *   - MITM 模式：访问 nodeseek 个人主页时自动抓取 cookie
 *   - Cron 模式：定时执行签到
 *
 * 配置项（优先级：$argument > 持久化存储 > 环境变量）：
 *   - nodeseek_data       账号数组（脚本自动写入，无需手动配置）
 *   - nodeseek_default    "false"=固定鸡腿（默认） / "true"=随机鸡腿
 *   - is_debug            "true"=输出详细日志（cookie 已脱敏）
 *
 * 推荐部署：使用配套的 nodeseek.sgmodule 模块文件。
 *
 * ⚠️ 仅供学习研究，使用前请阅读原作者免责声明。
 * ============================================================
 */

/* ====================== 配置区 ====================== */
const CONFIG = {
    name: "NodeSeek",
    ckName: "nodeseek_data",

    // 安全：域名白名单（仅允许这些 host 的 HTTPS 请求）
    allowedHosts: ["www.nodeseek.com"],

    // 安全：路径白名单（仅允许这些路径，防止域名白名单万一被绕过后被滥用）
    //   /api/attendance              → 签到
    //   /api/account/getInfo/<id>    → 查询账号信息
    // 任何指向发帖、私信、修改资料等其他 API 的请求都会被拒绝
    allowedPaths: [
        /^\/api\/attendance(\?|$)/,
        /^\/api\/account\/getInfo\/[^/]+(\?|$)/,
    ],

    baseUrl: "https://www.nodeseek.com",

    // 网络
    timeout: 15000,         // 单次请求超时（ms）
    retryCount: 2,          // 失败重试次数
    retryDelay: 2000,       // 重试间隔（ms）
    accountInterval: 1500,  // 多账号间隔（ms，防风控）

    api: {
        attendance: "/api/attendance",
        getInfo: (id) => `/api/account/getInfo/${id}?readme=1`,
    },
};

/* ====================== 初始化 ====================== */
const $ = new Env(CONFIG.name);
const userCookie =
    $.toObj($.isNode() ? process.env[CONFIG.ckName] : $.getdata(CONFIG.ckName)) || [];

$.userIdx = 0;
$.userList = [];
$.notifyMsg = [];

const notify = $.isNode() ? require("./sendNotify") : null;

// 解析 Surge 模块 $argument（形如 "is_default=false&is_debug=false"）
const moduleArgs = (() => {
    const result = {};
    if (typeof $argument === "undefined" || !$argument) return result;
    String($argument)
        .split("&")
        .forEach((pair) => {
            const idx = pair.indexOf("=");
            if (idx <= 0) return;
            const k = pair.slice(0, idx).trim();
            const v = pair.slice(idx + 1).trim();
            if (k) result[k] = v;
        });
    return result;
})();

// 配置读取优先级：$argument > 持久化存储 / 环境变量 > 默认值
$.is_debug =
    moduleArgs.is_debug ||
    ($.isNode() ? process.env.IS_DEBUG : $.getdata("is_debug")) ||
    "false";
$.is_default =
    moduleArgs.is_default ||
    ($.isNode() ? process.env["nodeseek_default"] : $.getdata("nodeseek_default")) ||
    "false";

/* ====================== 工具函数 ====================== */

/** Cookie/Token 脱敏（仅用于显示） */
function maskSecret(s) {
    if (!s || typeof s !== "string") return "<empty>";
    if (s.length <= 12) return "***";
    return `${s.slice(0, 6)}***${s.slice(-4)}`;
}

/** 安全 URL 校验：必须 HTTPS、host 在白名单、path 在白名单 */
function isAllowedUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== "https:") return false;
        if (!CONFIG.allowedHosts.includes(u.hostname)) return false;
        // 路径白名单：只允许签到和查账号信息这两个 API
        const fullPath = u.pathname + u.search;
        if (!CONFIG.allowedPaths.some((re) => re.test(fullPath))) return false;
        return true;
    } catch {
        return false;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 双日志：控制台 + 通知缓冲 */
function dlog(msg) {
    if (!msg) return;
    $.log(`${msg}`);
    $.notifyMsg.push(`${msg}`);
}

/** debug 日志（自动脱敏 cookie/token 字段） */
function debug(data, tag = "debug") {
    if ($.is_debug !== "true") return;
    let s = typeof data === "string" ? data : $.toStr(data) || String(data);
    if (s) {
        s = s
            .replace(/"cookie"\s*:\s*"[^"]+"/gi, '"cookie":"***masked***"')
            .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"***masked***"')
            .replace(/cookie:\s*[^\s;,}]+/gi, "cookie: ***masked***");
    }
    $.log(`\n--- ${tag} ---\n${s}\n--- end ---\n`);
}

/* ====================== 安全请求封装 ====================== */
/**
 * 带白名单校验、超时、重试的请求函数。
 * 任何不在 allowedHosts 内的 URL 都会被拒绝，防止脚本被篡改后泄漏数据。
 */
async function safeRequest(opts) {
    if (typeof opts === "string") opts = { url: opts };
    if (!opts?.url) throw new Error("缺少 url 参数");

    // 相对路径拼接
    if (opts.url.startsWith("/")) opts.url = CONFIG.baseUrl + opts.url;

    // 白名单校验（host + path 双重）
    if (!isAllowedUrl(opts.url)) {
        const u = new URL(opts.url);
        throw new Error(
            `拒绝请求非白名单地址: ${u.hostname}${u.pathname}`
        );
    }

    const method = (opts.type || (opts.body ? "post" : "get")).toLowerCase();
    const timeoutMs = opts.timeout || CONFIG.timeout;
    const headers = opts.headers || {};

    if (opts.dataType === "json" && !headers["content-type"]) {
        headers["content-type"] = "application/json;charset=UTF-8";
    }

    // 构造最终 URL（POST 时把 params 拼到 query）
    const finalUrl =
        method === "post" && opts.params
            ? `${opts.url}?${$.queryStr(opts.params)}`
            : opts.url;

    const reqOpts = {
        ...opts,
        url: finalUrl,
        headers,
        timeout: $.isSurge() ? Math.ceil(timeoutMs / 1000) : timeoutMs,
    };
    if (opts.body) {
        reqOpts.body =
            typeof opts.body === "object" ? $.toStr(opts.body) : opts.body;
    }

    let lastErr;
    for (let attempt = 0; attempt <= CONFIG.retryCount; attempt++) {
        try {
            const result = await Promise.race([
                $.http[method](reqOpts).then(
                    (r) => $.toObj(r.body) || r.body
                ),
                new Promise((_, rej) =>
                    setTimeout(() => rej(new Error("请求超时")), timeoutMs)
                ),
            ]);
            return result;
        } catch (e) {
            lastErr = e;
            if (attempt < CONFIG.retryCount) {
                $.log(
                    `[${method.toUpperCase()}] 第 ${attempt + 1} 次请求失败，${
                        CONFIG.retryDelay
                    }ms 后重试`
                );
                await sleep(CONFIG.retryDelay);
            }
        }
    }
    throw lastErr || new Error("请求失败");
}

/* ====================== 用户类 ====================== */
class UserInfo {
    constructor(user) {
        this.index = ++$.userIdx;
        this.token = user?.token || (typeof user === "string" ? user : "");
        this.userId = user?.userId || "";
        this.userName = user?.userName || `账号${this.index}`;
        this.ckStatus = true;

        // 公共请求头（小写以兼容 Loon h2）
        this.headers = {
            accept: "*/*",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "zh-CN,zh-Hans;q=0.9",
            connection: "keep-alive",
            cookie: this.token,
            host: "www.nodeseek.com",
            origin: "https://www.nodeseek.com",
            referer: "https://www.nodeseek.com/board",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
        };
    }

    /** 每日签到 */
    async signin(isRandom) {
        try {
            const res = await safeRequest({
                url: CONFIG.api.attendance,
                params: { random: isRandom },
                headers: { ...this.headers, "content-length": "0" },
                type: "post",
                alpn: "h2",
            });
            debug(res, "signin");
            const msg = res?.message || "";
            $.log(`[${this.userName}] 签到结果: ${msg}`);
            return msg;
        } catch (e) {
            this.ckStatus = false;
            $.log(`[${this.userName}] 签到失败: ${e?.message || e}`);
            return "";
        }
    }

    /** 查询账号信息（鸡腿数等） */
    async userAccount() {
        try {
            if (!this.userId) throw new Error("缺少 userId");
            const res = await safeRequest({
                url: CONFIG.api.getInfo(this.userId),
                headers: { ...this.headers, "content-length": "0" },
                alpn: "h2",
            });
            debug(res, "userAccount");
            return res?.detail;
        } catch (e) {
            this.ckStatus = false;
            $.log(`[${this.userName}] 查询账号失败: ${e?.message || e}`);
            return null;
        }
    }
}

/* ====================== 主流程 ====================== */

async function checkEnv() {
    if (!Array.isArray(userCookie) || userCookie.length === 0) {
        throw new Error("未检测到账号配置，请先通过 MITM 抓取 cookie");
    }

    const validUsers = userCookie
        .filter((u) => u && u.token && u.userId)
        .map((u) => new UserInfo(u));

    if (validUsers.length === 0) {
        throw new Error("账号配置不完整（缺少 token 或 userId）");
    }

    $.log(`\n[INFO] 检测到 ${validUsers.length} 个有效账号\n`);
    $.userList.push(...validUsers);
}

async function main() {
    for (let i = 0; i < $.userList.length; i++) {
        const user = $.userList[i];
        $.notifyMsg = [];
        $.title = "";

        try {
            $.log(
                `[${user.userName}] 签到模式: ${
                    $.is_default === "false" ? "固定鸡腿" : "随机鸡腿"
                }`
            );

            const signMsg = await user.signin($.is_default);
            $.title = signMsg;

            if (user.ckStatus) {
                const info = await user.userAccount();
                if (info) {
                    dlog(`「${info.member_name}」当前共 ${info.coin} 个鸡腿 🍗`);
                } else {
                    dlog(`⚠️「${user.userName}」账号信息查询失败`);
                }
            } else {
                dlog(`⛔️「${user.userName}」cookie 已失效，请重新抓取`);
            }

            await sendMsg($.notifyMsg.join("\n"));

            // 多账号间隔
            if (i < $.userList.length - 1) await sleep(CONFIG.accountInterval);
        } catch (e) {
            // 错误信息净化：只输出 message，避免打印含敏感数据的对象
            dlog(`[${user.userName}] 执行异常: ${e?.message || String(e)}`);
        }
    }
}

/* ====================== MITM 抓取 Cookie ====================== */
async function getCookie() {
    try {
        if ($request?.method === "OPTIONS") return;

        const headers = ObjectKeys2LowerCase($request?.headers || {});
        const token = headers.cookie;
        const body = $.toObj($response?.body);

        if (!token || !body) {
            throw new Error("cookie 或响应体为空");
        }

        const { member_id, member_name } = body?.detail || {};
        if (!member_id) {
            throw new Error("响应中未找到 member_id");
        }

        const newData = {
            userId: member_id,
            userName: member_name,
            token,
        };

        const idx = userCookie.findIndex((e) => e.userId === newData.userId);
        if (idx >= 0) userCookie[idx] = newData;
        else userCookie.push(newData);

        $.setjson(userCookie, CONFIG.ckName);

        // 通知里展示脱敏后的 cookie，避免截图泄漏
        $.msg(
            $.name,
            `🎉 ${newData.userName} 更新 cookie 成功`,
            `cookie: ${maskSecret(token)}`
        );
    } catch (e) {
        $.msg($.name, "⛔️ 抓取 cookie 失败", e?.message || String(e));
    }
}

/* ====================== 通知与小工具 ====================== */
async function sendMsg(msg) {
    if (!msg) return;
    if ($.isNode() && notify?.sendNotify) {
        await notify.sendNotify($.name, msg);
    } else {
        $.msg($.name, $.title || "", msg);
    }
}

function ObjectKeys2LowerCase(obj) {
    return obj
        ? Object.fromEntries(
              Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v])
          )
        : {};
}

/* ====================== 入口 ====================== */
!(async () => {
    try {
        // 模式判断：基于 $request.url 是否真的指向 nodeseek 的 getInfo API
        //
        // 背景：Surge 在手动运行 cron 脚本时，会注入一个 mock 的 $request/$response
        //       上下文（$request.url 通常是 http://www.apple.com/，
        //       $response.body 是 {"foo":"bar"}）。所以单纯用 typeof 判断
        //       全局变量是否存在不可靠。
        //
        // 真实分支：
        //   - MITM 触发：$request.url = https://www.nodeseek.com/api/account/getInfo/<id>?...
        //   - cron / 手动执行：$request.url 是 mock 值，不含 nodeseek 域名
        //   - Node.js：$request 不存在
        const reqUrl =
            typeof $request !== "undefined" &&
            $request &&
            typeof $request.url === "string"
                ? $request.url
                : "";
        const isMitmMode = reqUrl.includes("nodeseek.com/api/account/getInfo");

        if (isMitmMode) {
            await getCookie();
        } else {
            await checkEnv();
            await main();
        }
    } catch (e) {
        $.logErr(e);
        $.msg($.name, "⛔️ 脚本运行错误", e?.message || String(e));
    } finally {
        $.done({ ok: 1 });
    }
})();

/* ============================================================
 * Env.js  by  chavyleung
 *   - 跨平台兼容库（Surge/Loon/Stash/Shadowrocket/QuanX/Node.js）
 *   - 来源: https://github.com/chavyleung/scripts/blob/master/Env.min.js
 *   - 该函数保持原始 minified 形式以确保与上游一致；如需自审，
 *     可对照官方仓库的非压缩版本逐行核对。
 * ============================================================ */
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise(((e, r) => { s.call(this, t, ((t, s, a) => { t ? r(t) : e(s) })) })) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; if (this.getdata(t)) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e => { this.get({ url: t }, ((t, s, r) => e(r))) })) } runScript(t, e) { return new Promise((s => { let r = this.getdata("@chavy_boxjs_userCfgs.httpapi"); r = r ? r.replace(/\n/g, "").trim() : r; let a = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); a = a ? 1 * a : 20, a = e && e.timeout ? e.timeout : a; const [i, o] = r.split("@"), n = { url: `http://${o}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: a }, headers: { "X-Key": i, Accept: "*/*" }, timeout: a }; this.post(n, ((t, e, r) => s(r))) })).catch((t => this.logErr(t))) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), r = !s && this.fs.existsSync(e); if (!s && !r) return {}; { const r = s ? t : e; try { return JSON.parse(this.fs.readFileSync(r)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), r = !s && this.fs.existsSync(e), a = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, a) : r ? this.fs.writeFileSync(e, a) : this.fs.writeFileSync(t, a) } } lodash_get(t, e, s = void 0) { const r = e.replace(/\[(\d+)\]/g, ".$1").split("."); let a = t; for (const t of r) if (a = Object(a)[t], void 0 === a) return s; return a } lodash_set(t, e, s) { return Object(t) !== t || (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce(((t, s, r) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[r + 1]) >> 0 == +e[r + 1] ? [] : {}), t)[e[e.length - 1]] = s), t } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, r] = /^@(.*?)\.(.*?)$/.exec(t), a = s ? this.getval(s) : ""; if (a) try { const t = JSON.parse(a); e = t ? this.lodash_get(t, r, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, r, a] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(r), o = r ? "null" === i ? null : i || "{}" : "{}"; try { const e = JSON.parse(o); this.lodash_set(e, a, t), s = this.setval(JSON.stringify(e), r) } catch (e) { const i = {}; this.lodash_set(i, a, t), s = this.setval(JSON.stringify(i), r) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, ((t, s, r) => { !t && s && (s.body = r, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, r) })); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: r, headers: a, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: r, headers: a, body: i, bodyBytes: o }, i, o) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", ((t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } })).then((t => { const { statusCode: r, statusCode: a, headers: i, rawBody: o } = t, n = s.decode(o, this.encoding); e(null, { status: r, statusCode: a, headers: i, rawBody: o, body: n }, n) }), (t => { const { message: r, response: a } = t; e(r, a, a && s.decode(a.rawBody, this.encoding)) })) } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), void 0 === t.followRedirect || t.followRedirect || ((this.isSurge() || this.isLoon()) && (t["auto-redirect"] = !1), this.isQuanX() && (t.opts ? t.opts.redirection = !1 : t.opts = { redirection: !1 })), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, ((t, s, r) => { !t && s && (s.body = r, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, r) })); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t => { const { statusCode: s, statusCode: r, headers: a, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: r, headers: a, body: i, bodyBytes: o }, i, o) }), (t => e(t && t.error || "UndefinedError"))); break; case "Node.js": let r = require("iconv-lite"); this.initGotEnv(t); const { url: a, ...i } = t; this.got[s](a, i).then((t => { const { statusCode: s, statusCode: a, headers: i, rawBody: o } = t, n = r.decode(o, this.encoding); e(null, { status: s, statusCode: a, headers: i, rawBody: o, body: n }, n) }), (t => { const { message: s, response: a } = t; e(s, a, a && r.decode(a.rawBody, this.encoding)) })) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let r = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in r) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? r[e] : ("00" + r[e]).substr(("" + r[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let r = t[s]; null != r && "" !== r && ("object" == typeof r && (r = JSON.stringify(r)), e += `${s}=${r}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", r = "", a) { const i = t => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: return { url: t.url || t.openUrl || t["open-url"] }; case "Loon": return { openUrl: t.openUrl || t.url || t["open-url"], mediaUrl: t.mediaUrl || t["media-url"] }; case "Quantumult X": return { "open-url": t["open-url"] || t.url || t.openUrl, "media-url": t["media-url"] || t.mediaUrl, "update-pasteboard": t["update-pasteboard"] || t.updatePasteboard }; case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, r, i(a)); break; case "Quantumult X": $notify(e, s, r, i(a)); case "Node.js": }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), r && t.push(r), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, t.stack) } } wait(t) { return new Promise((e => setTimeout(e, t))) } done(t = {}) { const e = ((new Date).getTime() - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${e} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }
