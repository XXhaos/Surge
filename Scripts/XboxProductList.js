// Surge: script-response-body
// 递归提取 GET 响应中 actionType == "Cart" 的 {ProductId,SkuId,AvailabilityId}
// 以 product1/product2… 顺序写入 XboxProductList；完全重复则跳过
// 通知：🆕 新增 / 🔁 已存在（不含 URL），副标题仅显示「当前共有X个商品📦」

(function () {
  const STORE_KEY = 'XboxProductList';

  try {
    if ($request?.method?.toUpperCase() !== 'GET') return $done({});
    if (!$response?.body || typeof $response.body !== 'string') return $done({ body: $response?.body });

    // 解析 JSON；失败则尝试从文本抠出 JSON 片段
    let data;
    try {
      data = JSON.parse($response.body);
    } catch {
      const m = $response.body.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (m) { try { data = JSON.parse(m[1]); } catch {} }
      if (!data) return $done({ body: $response.body });
    }

    // 读取已有 store
    let store = {};
    try {
      const raw = $persistentStore.read(STORE_KEY);
      if (raw) store = JSON.parse(raw) || {};
    } catch { store = {}; }

    // 现有条目（仅 productN）按数字排序
    const entries = Object.keys(store)
      .filter(k => /^product\d+$/.test(k))
      .sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)))
      .map(k => store[k]);

    const same = (a, b) =>
      a && b &&
      String(a.ProductId||'') === String(b.ProductId||'') &&
      String(a.SkuId||'') === String(b.SkuId||'') &&
      String(a.AvailabilityId||'') === String(b.AvailabilityId||'');

    // 递归收集 Cart（去重当前响应内）
    const found = [];
    const seen = new Set();
    const isObj = v => v && typeof v === 'object';
    const visit = (node) => {
      if (!isObj(node)) return;
      if (typeof node.actionType === 'string' && node.actionType.toLowerCase() === 'cart') {
        const args = node.actionArguments;
        if (isObj(args)) {
          const r = {
            ProductId: String(args.ProductId ?? '').trim(),
            SkuId: String(args.SkuId ?? '').trim(),
            AvailabilityId: String(args.AvailabilityId ?? '').trim()
          };
          if (r.ProductId && r.SkuId && r.AvailabilityId) {
            const key = `${r.ProductId}||${r.SkuId}||${r.AvailabilityId}`;
            if (!seen.has(key)) { seen.add(key); found.push(r); }
          }
        }
      }
      if (Array.isArray(node)) node.forEach(visit);
      else Object.keys(node).forEach(k => visit(node[k]));
    };
    visit(data);

    if (found.length === 0) return $done({ body: $response.body });

    // 拆分新增/已存在
    const toAdd = [];
    const existed = [];
    for (const r of found) (entries.some(e => same(e, r)) ? existed : toAdd).push(r);

    let title = '';
    let detail = null;

    if (toAdd.length > 0) {
      // 追加为下一个 productN
      let maxIndex = 0;
      const keys = Object.keys(store).filter(k => /^product\d+$/.test(k));
      if (keys.length) maxIndex = Math.max(...keys.map(k => parseInt(k.slice(7), 10) || 0));

      for (const r of toAdd) {
        const key = `product${++maxIndex}`;
        store[key] = { ProductId: r.ProductId, SkuId: r.SkuId, AvailabilityId: r.AvailabilityId };
        entries.push(store[key]);
      }
      $persistentStore.write(JSON.stringify(store), STORE_KEY);

      title = '🆕 XboxProductList 已新增';
      detail = toAdd[0];
    } else {
      title = '🔁 XboxProductList 已存在，跳过';
      detail = existed[0];
    }

    // 统计当前商品总数（仅 productN 键）
    const productCount = Object.keys(store).filter(k => /^product\d+$/.test(k)).length;

    if (detail) {
      $notification.post(
        title,
        `当前共有 ${productCount} 个商品📦`,
        `信息如下：${JSON.stringify(detail)}`
      );
    }

    return $done({ body: $response.body });
  } catch (err) {
    $notification.post('❌ Xbox 抓取脚本异常', '', String(err));
    return $done({ body: $response?.body });
  }
})();
