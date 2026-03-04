/**
 * 百度贴吧 - 开屏广告拦截脚本
 * 适用于 Loon / Surge / Quantumult X
 * 拦截 splashAd 接口，返回空数据使 App 跳过开屏广告
 */

const url = $request.url;
let body = $response.body;

try {
  if (!body || body.length === 0) {
    $done({});
    return;
  }

  let obj = JSON.parse(body);

  // 清空开屏广告数据
  if (obj) {
    // 置空广告列表字段（常见字段名）
    const adFields = [
      'data', 'adData', 'ad_data', 'splash', 'splashData',
      'ads', 'adList', 'ad_list', 'adInfoList', 'items'
    ];

    adFields.forEach(field => {
      if (obj[field] !== undefined) {
        if (Array.isArray(obj[field])) {
          obj[field] = [];
        } else if (typeof obj[field] === 'object' && obj[field] !== null) {
          obj[field] = {};
        }
      }
    });

    // 设置错误码让客户端跳过广告展示
    if (obj.errno !== undefined) obj.errno = -1;
    if (obj.error_code !== undefined) obj.error_code = -1;
    if (obj.errmsg !== undefined) obj.errmsg = 'no ad';
    if (obj.show !== undefined) obj.show = 0;

    body = JSON.stringify(obj);
  }
} catch (e) {
  // 如果解析失败，返回空的合法JSON
  body = JSON.stringify({ errno: -1, errmsg: 'no ad', data: [] });
}

$done({ body });
