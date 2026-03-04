/**
 * 百度贴吧 - 信息流广告过滤脚本 v2.0
 * 过滤首页/关注页信息流中的广告卡片
 * 包括：原生广告卡片、精选热推、游戏推广、下载类广告等
 */

let body = $response.body;

try {
  if (!body || body.length === 0) {
    $done({});
    return;
  }

  let obj = JSON.parse(body);

  // ── 广告类型字符串关键词 ──────────────────────────────
  const adTypeKeywords = [
    'ad', 'ad_pb', 'ad_thread', 'ad_native', 'ad_card',
    'feed_ad', 'native_ad', 'banner_ad', 'promote',
    'promotion', 'promoted', 'sponsored', 'cpa', 'cpc', 'cpm',
    'advert', 'advertisement', 'hot_push', 'hot_rec',
    // 贴吧"精选热推"专属标识
    'jx_rec', 'jingxuan', 'selected_push', 'hot_recommend'
  ];

  // ── 广告布尔/数值标志字段名 ──────────────────────────
  const adFlagFields = [
    'is_ad', 'isAd', 'ad_flag', 'adFlag', 'show_ad',
    'is_promotion', 'is_promote', 'is_sponsored',
    'is_hot_push', 'is_rec', 'is_recommend_ad',
    'has_ad', 'ad_mark', 'ad_label'
  ];

  // ── 广告专属数据字段名（存在即为广告）──────────────
  const adExclusiveFields = [
    'ad_pb',          // 贴吧广告二进制标识
    'ad_info',        // 广告详情对象
    'ad_extra',       // 广告扩展信息
    'ad_src',         // 广告来源
    'ad_id',          // 广告 ID
    'creative_id',    // 创意 ID（广告素材）
    'ecpm',           // 千次展示费用（广告竞价字段）
    'landing_page',   // 落地页（下载广告特有）
    'download_url',   // 下载链接
    'app_download',   // App 下载信息
    'market_info',    // 应用市场信息
    'click_url',      // 广告点击链接
  ];

  /**
   * 判断一个条目是否为广告
   */
  function isAdItem(item) {
    if (!item || typeof item !== 'object') return false;

    // 1. 检查广告专属字段是否存在
    for (const field of adExclusiveFields) {
      if (item[field] !== undefined && item[field] !== null && item[field] !== '') {
        return true;
      }
    }

    // 2. 检查布尔/数值广告标志
    for (const flag of adFlagFields) {
      const val = item[flag];
      if (val === 1 || val === true || val === '1' || val === 'true') {
        return true;
      }
    }

    // 3. 检查 type / thread_type / item_type / card_type 等类型字段
    const typeFields = [
      'type', 'thread_type', 'item_type', 'card_type',
      'content_type', 'feed_type', 'post_type', 'rec_type'
    ];
    for (const field of typeFields) {
      if (item[field] !== undefined) {
        const val = String(item[field]).toLowerCase();
        if (adTypeKeywords.some(kw => val === kw || val.includes(kw))) {
          return true;
        }
      }
    }

    // 4. 检查标题或描述是否含有广告标签文字（兜底）
    const textFields = ['title', 'desc', 'abstract', 'label', 'tag'];
    const adTextMarkers = ['广告', '推广', '精选热推', '热推', 'Ad', 'Sponsored'];
    for (const field of textFields) {
      if (item[field] && typeof item[field] === 'string') {
        if (adTextMarkers.some(marker => item[field].includes(marker))) {
          return true;
        }
      }
    }

    // 5. 检查嵌套的 extend / extra / info 对象中是否有广告字段
    const nestedFields = ['extend', 'extra', 'info', 'ext', 'meta'];
    for (const field of nestedFields) {
      if (item[field] && typeof item[field] === 'object') {
        if (isAdItem(item[field])) return true;
      }
    }

    return false;
  }

  /**
   * 递归遍历，清除所有广告条目
   */
  function removeAds(data) {
    if (Array.isArray(data)) {
      return data
        .filter(item => !isAdItem(item))
        .map(item => removeAds(item));
    } else if (data && typeof data === 'object') {
      const cleaned = {};
      for (const key of Object.keys(data)) {
        // 整个字段就是广告容器则跳过
        const keyLower = key.toLowerCase();
        if (adTypeKeywords.some(kw => keyLower === kw)) continue;
        cleaned[key] = removeAds(data[key]);
      }
      return cleaned;
    }
    return data;
  }

  obj = removeAds(obj);
  body = JSON.stringify(obj);

} catch (e) {
  console.log('[贴吧去广告] 信息流处理出错: ' + e.message);
}

$done({ body });
