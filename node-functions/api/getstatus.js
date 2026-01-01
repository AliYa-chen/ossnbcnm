// 获取项目状态信息
export async function onRequest({ request, env }) {

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }


  const TENCENT_API = "https://console.cloud.tencent.com/cgi/capi";
  const PROJECT_ID = env.PROJECT_ID;
  const UIN = env.UIN;
  const SKEY = env.SKEY;
  const CSRF_CODE = env.CSRF_CODE;
  const X_Lid = env.X_LID;
  const X_Life = env.X_LIFE;

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
    uin: `${UIN}`,
    ownerUin: `${UIN}`,
    csrfCode: `${CSRF_CODE}`
  });

  const headers = {
    "Origin": "https://console.cloud.tencent.com",
    "Referer": `https://console.cloud.tencent.com/edgeone/pages/project/${PROJECT_ID}/index`,
    "X-Lid": `${X_Lid}`,
    "X-Life": `${X_Life}`,
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Cookie": `uin=o${UIN};skey=${SKEY}; `,
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
