export async function onRequest() {
  const TENCENT_API = "https://console.cloud.tencent.com/cgi/capi";
  const PROJECT_ID = "pages-5h7pjoaakgaq";

  // query 参数
  const query = new URLSearchParams({
    cmd: "DescribeOpenEdgeResources",
    action: "delegate",
    serviceType: "teo",
    secure: "1",
    version: "3",
    dictId: "2841",
    withLanguage: "1",
    sts: "1",
    t: Date.now().toString(),      // 动态时间戳
    uin: "100007990988",
    ownerUin: "100007990988",
    csrfCode: "1948106127"
  });

  const headers = {
    "Origin": "https://console.cloud.tencent.com",
    "Referer": "https://console.cloud.tencent.com/edgeone/pages/project/pages-5h7pjoaakgaq/index",
    "X-Lid": "yJz69bpBY",
    "X-Life": "3503406",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Cookie": "uin=o100007990988;skey=E5RqNSQtFIzzZt-inxddSGuYsGKp4JMbiNlSwYLL2Fs_; nodesess=7de21131-9835-5cc1-dc33-d18b03c70928",
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Connection": "keep-alive"
  };

  const body = {
    regionId: 1,
    serviceType: "teo",
    cmd: "DescribeOpenEdgeResources",
    data: {
      Version: "2022-09-01",
      Region: "ap-guangzhou",
      Interface: "pages:DescribePagesDeployments",
      Payload: JSON.stringify({
        ProjectId: PROJECT_ID,
        Offset: 0,
        Limit: 1,
        DeploymentIds: [],
        Filters: [],
        OrderBy: "CreatedOn"
      })
    }
  };

  try {
    const res = await fetch(`${TENCENT_API}?${query.toString()}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const json = await res.json();

    let usedInProd = false;
    try {
      const resultStr = json?.data?.data?.Response?.Result;
      if (resultStr) {
        const result = JSON.parse(resultStr);
        const deployments = result.Deployments || [];
        if (deployments.length > 0) {
          usedInProd = deployments[0].UsedInProd === true;
        }
      }
    } catch (err) {
      console.error("解析 Result 失败", err);
    }

    return new Response(JSON.stringify({ usedInProd }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ usedInProd: false, error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}
