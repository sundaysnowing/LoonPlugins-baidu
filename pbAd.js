/**
 * 百度贴吧 - 帖子页广告过滤脚本
 * 过滤帖子列表（pb/page）中插入的广告楼层
 */

let body = $response.body;

try {
  if (!body || body.length === 0) {
    $done({});
    return;
  }

  let obj = JSON.parse(body);

  /**
   * 判断是否为广告楼层
   * 贴吧帖子中广告通常通过特定字段标识
   */
  function isAdPost(post) {
    if (!post || typeof post !== 'object') return false;

    // ad_pb 字段：贴吧广告楼层专属标识
    if (post.ad_pb !== undefined) return true;

    // 类型字段包含 ad
    const typeVal = String(post.type || post.post_type || '').toLowerCase();
    if (typeVal.includes('ad') || typeVal === 'promotion') return true;

    // is_ad 标志
    if (post.is_ad === 1 || post.is_ad === true) return true;

    // 楼层内容中存在广告标识
    if (post.content && Array.isArray(post.content)) {
      for (const c of post.content) {
        if (c && (c.type === 'ad' || c.ad_pb !== undefined)) return true;
      }
    }

    return false;
  }

  // 过滤帖子列表中的广告楼层
  const postListKeys = ['post_list', 'postList', 'posts', 'comment_list', 'thread_list'];

  for (const key of postListKeys) {
    if (obj.data && Array.isArray(obj.data[key])) {
      const before = obj.data[key].length;
      obj.data[key] = obj.data[key].filter(post => !isAdPost(post));
      const removed = before - obj.data[key].length;
      if (removed > 0) {
        console.log(`[贴吧去广告] 移除 ${removed} 条广告楼层 (${key})`);
      }
    }
    if (Array.isArray(obj[key])) {
      obj[key] = obj[key].filter(post => !isAdPost(post));
    }
  }

  // 清理顶部/底部 Banner 广告数据
  const bannerAdKeys = ['top_ad', 'bottom_ad', 'banner_ad', 'inline_ad', 'ad_info', 'native_ad'];
  for (const key of bannerAdKeys) {
    if (obj.data && obj.data[key] !== undefined) {
      obj.data[key] = Array.isArray(obj.data[key]) ? [] : {};
    }
    if (obj[key] !== undefined) {
      obj[key] = Array.isArray(obj[key]) ? [] : {};
    }
  }

  body = JSON.stringify(obj);

} catch (e) {
  console.log('[贴吧去广告] 处理帖子广告出错: ' + e.message);
}

$done({ body });
