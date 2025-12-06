/**
 * Surge Script - 重放指定的购物车请求
 */

// 从 persistentStore 读取参数
const cartId = $persistentStore.read("cartId");
const authorization = $persistentStore.read("authorization");
const x_ms_vector_id = $persistentStore.read("x-ms-vector-id");
const x_authorization_muid = $persistentStore.read("x-authorization-muid");
const ms_cv = $persistentStore.read("ms-cv");
const x_ms_tracking_id = $persistentStore.read("x-ms-tracking-id");
const x_ms_reference_id = $persistentStore.read("x-ms-reference-id");
const x_ms_correlation_id = $persistentStore.read("x-ms-correlation-id");

// 检查是否成功读取到值
if (!cartId || !authorization || !x_ms_vector_id || !x_authorization_muid || !ms_cv || !x_ms_tracking_id || !x_ms_reference_id || !x_ms_correlation_id) {
    $notification.post("错误", "未找到必要的参数，请确保已正确存储所有参数。", "");
    $done();
}

// ==== 请求参数 ==== //
const API_URL = "https://buynow.production.store-web.dynamics.com/v1.0/Cart/RequestParentalApproval?appId=BuyNow";

// ==== 请求头 ==== //
const HEADERS = {
  "x-ms-market": "NG",
  "referer": "https://www.microsoft.com/",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3.1 Mobile/15E148 Safari/604.1",
  "x-ms-tracking-id": x_ms_tracking_id,  // 使用从 persistentStore 获取的 x-ms-tracking-id
  "origin": "https://www.microsoft.com",
  "sec-fetch-dest": "empty",
  "x-ms-client-type": "XboxCom",
  "sec-fetch-site": "cross-site",
  "x-ms-vector-id": x_ms_vector_id,  // 使用从 persistentStore 获取的 x-ms-vector-id
  "x-authorization-muid": x_authorization_muid,  // 使用从 persistentStore 获取的 x-authorization-muid
  "authorization": authorization,  // 使用从 persistentStore 获取的 authorization
  "accept-language": "ha-Latn-NG,ha;q=0.9",
  "ms-reference-id": x_ms_reference_id,  // 使用从 persistentStore 获取的 x-ms-reference-id
  "ms-cv": ms_cv,  // 使用从 persistentStore 获取的 ms-cv
  "accept": "*/*",
  "content-type": "application/json",
  "accept-encoding": "gzip, deflate, br",
  "x-ms-correlation-id": x_ms_correlation_id,  // 使用从 persistentStore 获取的 x-ms-correlation-id
  "sec-fetch-mode": "cors"
};

// 请求体构建
const body = {
  cartId: cartId,
  client: "XboxCom",
  flights: ["sc_fincastlebuynowgreenlogo","sc_xboxspinner","sc_xboxclosebutton","sc_xboxgamepadlite","sc_xboxuiexp","sc_disabledefaultstyles","sc_gamertaggifting","sc_abandonedretry","sc_addasyncpitelemetry","sc_adddatapropertyiap","sc_addfocuslocktosubscriptionmodal","sc_aemparamforimage","sc_aemrdslocale","sc_allowapplepay","sc_allowapplepayforcheckout","sc_allowbuynowrupay","sc_allowcustompifiltering","sc_allowelo","sc_allowfincastlerewardsforsubs","sc_allowgooglepay","sc_allowgooglepayforcheckout","sc_allowmpesapi","sc_allowparallelorderload","sc_allowpaypay","sc_allowpaypayforcheckout","sc_allowpaysafecard","sc_allowpaysafeforus","sc_allowrupay","sc_allowrupayforcheckout","sc_allowsmdmarkettobeprimarypi","sc_allowupi","sc_allowupiforbuynow","sc_allowupiforcheckout","sc_allowupiqr","sc_allowupiqrforbuynow","sc_allowupiqrforcheckout","sc_allowvenmo","sc_allowvenmoforbuynow","sc_allowvenmoforcheckout","sc_allowverve","sc_analyticsforbuynow","sc_apperrorboundarytsenabled","sc_askaparentinsufficientbalance","sc_askaparentssr","sc_askaparenttsenabled","sc_asyncpiurlupdate","sc_asyncpurchasefailure","sc_asyncpurchasefailurexboxcom","sc_autorenewalconsentnarratorfix","sc_bankchallenge","sc_bankchallengecheckout","sc_blockcsvpurchasefrombuynow","sc_blocklegacyupgrade","sc_buynowfocustrapkeydown","sc_buynowglobalpiadd","sc_buynowlegalterms","sc_buynowlistpichanges","sc_buynownonprodendpoint","sc_buynowprodendpoint","sc_buynowprodigilegalstrings","sc_buynowuipreload","sc_buynowuiprod","sc_cartcofincastle","sc_cartrailexperiment1","sc_cat2itemsfix","sc_cawarrantytermsv2","sc_checkoutglobalpiadd","sc_checkoutitemfontweight","sc_checkoutredeem","sc_clientdebuginfo","sc_clienttelemetryforceenabled","sc_clienttorequestorid","sc_combinedredeemlegalterms","sc_contactpreferenceactionts","sc_contactpreferenceupdate","sc_contactpreferenceupdatexboxcom","sc_conversionblockederror","sc_copycurrentcart","sc_cpdeclinedv2","sc_culturemarketinfo","sc_delayretry","sc_devicerepairpifilter","sc_digitallicenseterms","sc_disableupgradetrycheckout","sc_eligibilityapi","sc_emptycartexperiment","sc_emptyresultcheck","sc_enablecartcreationerrorparsing","sc_enablekakaopay","sc_errorpageviewfix","sc_errorstringsts","sc_euomnibusprice","sc_expandedpurchasespinner","sc_extendpagetagtooverride","sc_fetchlivepersonfromparentwindow","sc_fincastlebuynowallowlist","sc_fincastlebuynowv2strings","sc_fincastlecalculation","sc_fincastlecallerapplicationidcheck","sc_fincastleui","sc_fingerprinttagginglazyload","sc_fixforcalculatingtax","sc_fixredeemautorenew","sc_flexsubs","sc_gco","sc_giftinglegalterms","sc_giftingtelemetryfix","sc_giftserversiderendering","sc_globalhidecssphonenumber","sc_greenshipping","sc_handledccemptyresponse","sc_hidegcolinefees","sc_hidesubscriptionprice","sc_hipercard","sc_imagelazyload","sc_inlineshippingselectormsa","sc_inlinetempfix","sc_jarvisconsumerprofile","sc_klarna","sc_loadingspinner","sc_lowbardiscountmap","sc_mapinapppostdata","sc_marketswithmigratingcssphonenumber","sc_morayfont","sc_moraystyle","sc_narratoraddress","sc_newcheckoutselectorforxboxcom","sc_newconversionurl","sc_newflexiblepaymentsmessage","sc_nextpidl","sc_noawaitforupdateordercall","sc_officescds","sc_optionalcatalogclienttype","sc_ordercheckoutfix","sc_orderpisyncdisabled","sc_outofstock","sc_parentalapprovalasyncheader","sc_passthroughculture","sc_paymentchallengets","sc_paymentoptionnotfound","sc_pidlignoreesckey","sc_pitelemetryupdates","sc_preloadpidlcontainerts","sc_productimageoptimization","sc_prominenteddchange","sc_promocode","sc_promocodecheckout","sc_purchaseblock","sc_purchaseblockerrorhandling","sc_purchasedblocked","sc_purchasedblockedby","sc_quantitycap","sc_railv2","sc_reactcheckout","sc_readytopurchasefix","sc_redeemfocusforce","sc_redeemsubscriptionlegalterms","sc_reloadiflineitemdiscrepancy","sc_removeresellerforstoreapp","sc_resellerdetail","sc_returnoospsatocart","sc_rspv2","sc_scenariotelemetryrefactor","sc_setbehaviordefaultvalue","sc_shippingallowlist","sc_showcontactsupportlink","sc_showtax","sc_skippurchaseconfirm","sc_skipselectpi","sc_splipidltresourcehelper","sc_surveyurlv2","sc_testflight","sc_updateallowedpaymentmethodstoadd","sc_updatebillinginfo","sc_updateformatjsx","sc_updateredemptionlink","sc_updatewarrantycompletesurfaceproinlinelegalterm","sc_updatewarrantytermslink","sc_usehttpsurlstrings","sc_usekoreanlegaltermstring","sc_uuid","sc_xboxcomnosapi","sc_xboxrecofix","sc_xboxredirection","sc_xdlshipbuffer"]
};

// 将请求体对象转换为字符串
const bodyString = JSON.stringify(body);

// 发送请求的函数
function sendRequest() {
  $httpClient.post({
    url: API_URL,
    headers: HEADERS,
    body: bodyString
  }, (error, response) => {
    if (error) {
      $notification.post("请求失败", `错误信息: ${error}`, "");
    } else {
      // 输出 HTTP 状态码和返回内容
      console.log("HTTP 状态码: " + response.status);// 输出状态码
      // console.log("返回请求头: " + JSON.stringify(response.headers));      // 输出返回的内容
      
      if (response.status === 200) {
        $notification.post("请求成功", `状态码: ${response.status}`, "");
      } else {
        $notification.post("请求失败", `HTTP状态码: ${response.status}`, "");
      }
    }
    $done();
  });
}

// 启动执行请求
sendRequest();