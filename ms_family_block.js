const targetUrl = 'https://account.microsoft.com/family/api/buy/requests/complete';
const blockedIds = new Set([
  "9PNTSH5SKCL5",
  "9nfmccp0pm67",
  "9npbvj8lwsvn",
  "9pcgszz8zpq2",
  "9P54FF0VQD7R",
  "9NCJZN3LBD3P",
  "9P9CLTVLLHD6",
  "9NHXDFLDBN6G"
].map(id => id.toLowerCase()));

if ($request.url === targetUrl) {
  try {
    const body = JSON.parse($request.body);
    const productId = body?.productId?.toLowerCase();
    
    if (productId && blockedIds.has(productId)) {
      $done({ response: { status: 403 } });
    } else {
      $done({});
    }
  } catch (e) {
    $done({});
  }
} else {
  $done({});
}