/**
 * 百度贴吧 - 信息流广告过滤脚本
 * 过滤论坛首页、关注页等信息流中的广告卡片
 */

let body = $response.body;

try {
  if (!body || body.length === 0) {
    $done({});
    return;
  }

  let obj = JSON.parse(body);

  // 广告类型标识关键词
  const adTypes = [
    'ad', 'AD', 'Ad',
    'ad_pb', 'ad_thread', 'ad_native',
    'promotion', 'sponsored', 'feed_ad',
    'native_ad', 'banner_ad', 'cpa',
    'advert', 'advertisement'
  ];

  /**
   * 判断一个对象是否为广告条目
   */
  function isAdItem(item) {
    if (!item || typeof item !== 'object') return false;

    // 检查 thread_type / type 字段
    const typeFields = ['thread_type', 'type', 'item_type', 'card_type', 'content_type'];
    for (const field of typeFields) {
      if (item[field] !== undefined) {
        const val = String(item[field]).toLowerCase();
        if (adTypes.some(t => val.includes(t.toLowerCase()))) return true;
      }
    }

    // 检查是否含有广告标记字段
    const adFlags = ['is_ad', 'isAd', 'ad_flag', 'adFlag', 'show_ad', 'ad_info'];
    for (const flag of adFlags) {
      if (item[flag] === 1 || item[flag] === true || item[flag] === '1') return true;
    }

    // 检查 ad_pb 字段（贴吧特有广告标识）
    if (item.ad_pb !== undefined) return true;

    return false;
  }

  /**
   * 递归清理对象/数组中的广告条目
   */
  function removeAds(data) {
    if (Array.isArray(data)) {
      return data.filter(item => !isAdItem(item)).map(item => removeAds(item));
    } else if (data && typeof data === 'object') {
      const cleaned = {};
      for (const key of Object.keys(data)) {
        // 跳过纯广告字段
        if (adTypes.some(t => key.toLowerCase() === t.toLowerCase())) continue;
        cleaned[key] = removeAds(data[key]);
      }
      return cleaned;
    }
    return data;
  }

  obj = removeAds(obj);
  body = JSON.stringify(obj);

} catch (e) {
  // 解析或处理失败，透传原始响应
  console.log('[贴吧去广告] 处理信息流广告出错: ' + e.message);
}

$done({ body });
