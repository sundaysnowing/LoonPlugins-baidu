/**
 * 百度贴吧 ProtoBuf 广告过滤脚本 v1.0
 * 处理接口：
 *   - /c/f/excellent/personalized  (精选推荐/信息流)
 *   - /c/f/frs/page                (吧内帖子列表)
 *   - /c/f/ad/getFeedAd            (信息流广告专用接口)
 *   - /c/b/ad/adBid                (广告竞价)
 *   - /c/f/pb/page                 (帖子评论页)
 *   - /c/f/frs/generalTabList      (综合tab列表)
 *
 * 贴吧使用 ProtoBuf 编码，但实际传输层仍为 msgpack 包装。
 * 本脚本采用通用字段扫描方式，不依赖 proto 定义文件。
 */

const url = $request.url;

// ── 广告识别规则 ──────────────────────────────────────────

// 广告专属字段（存在即判定为广告）
const AD_EXCLUSIVE_KEYS = new Set([
  'ad_pb', 'ad_info', 'ad_extra', 'ad_src', 'ad_id',
  'creative_id', 'ecpm', 'landing_page', 'download_url',
  'app_download', 'market_info', 'click_url', 'ad_type',
  'ad_data', 'ad_pos', 'advert_id', 'plan_id', 'unit_id',
  'auc_id', 'cpa_type', 'cpc_type', 'feed_type_ad',
]);

// 广告标志字段（值为真时判定为广告）
const AD_FLAG_KEYS = [
  'is_ad', 'isAd', 'ad_flag', 'adFlag', 'show_ad',
  'is_promotion', 'is_promote', 'is_sponsored',
  'is_rec', 'is_recommend_ad', 'has_ad', 'ad_mark',
];

// 伪装成普通内容的广告账号名
const FAKE_AUTHOR_NAMES = [
  '精选推荐', '精选热推', '热门推荐', '官方推荐',
  '贴吧推荐', '为你推荐', '广告', '推广', '热推',
];

// 广告 CTA 按钮文字
const AD_CTA_TEXTS = [
  '立即查看', '立即下载', '立即体验', '立即安装',
  '立即领取', '点击查看', '马上查看', '去看看',
  '免费领取', '立即预约', '立即参与', '立即开始',
];

// 广告类型值关键词
const AD_TYPE_KEYWORDS = [
  'ad', 'ad_pb', 'native_ad', 'feed_ad', 'promote',
  'promotion', 'promoted', 'sponsored', 'cpa', 'cpc',
];

/**
 * 判断一个对象是否为广告条目
 */
function isAd(item) {
  if (!item || typeof item !== 'object') return false;

  // 1. 广告专属字段存在
  for (const key of Object.keys(item)) {
    if (AD_EXCLUSIVE_KEYS.has(key) &&
        item[key] !== undefined &&
        item[key] !== null &&
        item[key] !== '') {
      return true;
    }
  }

  // 2. 广告标志字段为真
  for (const key of AD_FLAG_KEYS) {
    const v = item[key];
    if (v === 1 || v === true || v === '1' || v === 'true') return true;
  }

  // 3. 类型字段含广告关键词
  const typeFields = ['type', 'thread_type', 'item_type', 'card_type',
                      'content_type', 'feed_type', 'post_type', 'rec_type'];
  for (const f of typeFields) {
    if (item[f] !== undefined) {
      const v = String(item[f]).toLowerCase();
      if (AD_TYPE_KEYWORDS.some(kw => v === kw || v.includes(kw))) return true;
    }
  }

  // 4. 伪装账号名检查（精选推荐等）
  const authorFields = ['author_name', 'nickname', 'name',
                        'show_nickname', 'from_nickname', 'uname'];
  for (const f of authorFields) {
    if (item[f] && typeof item[f] === 'string') {
      if (FAKE_AUTHOR_NAMES.some(n => item[f].includes(n))) return true;
    }
  }

  // 5. CTA 按钮文字检查
  const ctaFields = ['btn_text', 'button_text', 'cta_text',
                     'action_text', 'link_text', 'jump_text'];
  for (const f of ctaFields) {
    if (item[f] && typeof item[f] === 'string') {
      if (AD_CTA_TEXTS.some(c => item[f].includes(c))) return true;
    }
  }

  // 6. 嵌套对象递归检查
  for (const f of ['extend', 'extra', 'info', 'ext', 'meta', 'ad']) {
    if (item[f] && typeof item[f] === 'object' && isAd(item[f])) return true;
  }

  return false;
}

/**
 * 递归清理对象中的广告条目
 */
function removeAds(data) {
  if (Array.isArray(data)) {
    return data
      .filter(item => !isAd(item))
      .map(item => removeAds(item));
  }
  if (data && typeof data === 'object') {
    const out = {};
    for (const k of Object.keys(data)) {
      // 跳过纯广告容器字段
      if (AD_TYPE_KEYWORDS.includes(k.toLowerCase())) continue;
      out[k] = removeAds(data[k]);
    }
    return out;
  }
  return data;
}

// ── MessagePack 解码/编码器 ───────────────────────────────
const MsgPack = (() => {
  function decode(buffer) {
    const view = new DataView(buffer);
    let o = 0;
    const ru8  = () => view.getUint8(o++);
    const ru16 = () => { const v = view.getUint16(o); o+=2; return v; };
    const ru32 = () => { const v = view.getUint32(o); o+=4; return v; };
    const ri8  = () => { const v = view.getInt8(o);   o+=1; return v; };
    const ri16 = () => { const v = view.getInt16(o);  o+=2; return v; };
    const ri32 = () => { const v = view.getInt32(o);  o+=4; return v; };
    const rf32 = () => { const v = view.getFloat32(o);o+=4; return v; };
    const rf64 = () => { const v = view.getFloat64(o);o+=8; return v; };
    const ri64 = () => { const h=view.getUint32(o);o+=4;const l=view.getUint32(o);o+=4;return h*4294967296+l; };
    const rStr = n => { const b=new Uint8Array(buffer,o,n);o+=n;return new TextDecoder().decode(b); };
    const rBin = n => { const b=new Uint8Array(buffer,o,n);o+=n;return b; };
    const rArr = n => { const a=[];for(let i=0;i<n;i++)a.push(rv());return a; };
    const rMap = n => { const m={};for(let i=0;i<n;i++){const k=rv();m[k]=rv();}return m; };
    function rv() {
      const b = ru8();
      if((b&0x80)===0)return b;
      if((b&0xf0)===0x80)return rMap(b&0xf);
      if((b&0xf0)===0x90)return rArr(b&0xf);
      if((b&0xe0)===0xa0)return rStr(b&0x1f);
      if((b&0xe0)===0xe0)return b-256;
      switch(b){
        case 0xc0:return null;case 0xc2:return false;case 0xc3:return true;
        case 0xca:return rf32();case 0xcb:return rf64();
        case 0xcc:return ru8();case 0xcd:return ru16();case 0xce:return ru32();case 0xcf:return ri64();
        case 0xd0:return ri8();case 0xd1:return ri16();case 0xd2:return ri32();case 0xd3:return ri64();
        case 0xd9:return rStr(ru8());case 0xda:return rStr(ru16());case 0xdb:return rStr(ru32());
        case 0xdc:return rArr(ru16());case 0xdd:return rArr(ru32());
        case 0xde:return rMap(ru16());case 0xdf:return rMap(ru32());
        case 0xc4:return rBin(ru8());case 0xc5:return rBin(ru16());case 0xc6:return rBin(ru32());
        default:return null;
      }
    }
    return rv();
  }

  function encode(val) {
    const ch=[];
    const w8  = v=>ch.push(new Uint8Array([v&0xff]));
    const w16 = v=>{const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v);ch.push(b);};
    const w32 = v=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v);ch.push(b);};
    const wi8 = v=>{const b=new Uint8Array(1);new DataView(b.buffer).setInt8(0,v);ch.push(b);};
    const wi16= v=>{const b=new Uint8Array(2);new DataView(b.buffer).setInt16(0,v);ch.push(b);};
    const wi32= v=>{const b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,v);ch.push(b);};
    const wf64= v=>{const b=new Uint8Array(8);new DataView(b.buffer).setFloat64(0,v);ch.push(b);};
    function wStr(s){
      const e=new TextEncoder().encode(s);const l=e.length;
      if(l<=31)w8(0xa0|l);else if(l<=0xff){w8(0xd9);w8(l);}else if(l<=0xffff){w8(0xda);w16(l);}else{w8(0xdb);w32(l);}
      ch.push(e);
    }
    function wv(v){
      if(v===null||v===undefined){w8(0xc0);return;}
      if(v===false){w8(0xc2);return;}if(v===true){w8(0xc3);return;}
      if(typeof v==='number'){
        if(Number.isInteger(v)){
          if(v>=0){if(v<=127)w8(v);else if(v<=0xff){w8(0xcc);w8(v);}else if(v<=0xffff){w8(0xcd);w16(v);}else{w8(0xce);w32(v);}}
          else{if(v>=-32)w8(v&0xff);else if(v>=-128){w8(0xd0);wi8(v);}else if(v>=-32768){w8(0xd1);wi16(v);}else{w8(0xd2);wi32(v);}}
        }else{w8(0xcb);wf64(v);}return;
      }
      if(typeof v==='string'){wStr(v);return;}
      if(v instanceof Uint8Array){
        const l=v.length;if(l<=0xff){w8(0xc4);w8(l);}else if(l<=0xffff){w8(0xc5);w16(l);}else{w8(0xc6);w32(l);}
        ch.push(v);return;
      }
      if(Array.isArray(v)){
        const l=v.length;if(l<=15)w8(0x90|l);else if(l<=0xffff){w8(0xdc);w16(l);}else{w8(0xdd);w32(l);}
        v.forEach(wv);return;
      }
      if(typeof v==='object'){
        const ks=Object.keys(v);const l=ks.length;
        if(l<=15)w8(0x80|l);else if(l<=0xffff){w8(0xde);w16(l);}else{w8(0xdf);w32(l);}
        ks.forEach(k=>{wStr(k);wv(v[k]);});return;
      }
    }
    wv(val);
    const total=ch.reduce((s,c)=>s+c.length,0);
    const out=new Uint8Array(total);let pos=0;
    ch.forEach(c=>{out.set(c,pos);pos+=c.length;});
    return out;
  }
  return {decode, encode};
})();

// ── 主逻辑 ────────────────────────────────────────────────
try {
  const bodyBytes = $response.bodyBytes;
  if (!bodyBytes || bodyBytes.byteLength === 0) { $done({}); }

  // /c/f/ad/getFeedAd 是纯广告接口，直接返回空
  if (url.includes('/c/f/ad/getFeedAd') || url.includes('/c/b/ad/adBid')) {
    console.log('[贴吧去广告] 拦截纯广告接口: ' + url);
    $done({ bodyBytes: MsgPack.encode({ errno: 0, errmsg: 'success', data: {} }) });
  }

  const buffer = bodyBytes.buffer.slice(
    bodyBytes.byteOffset,
    bodyBytes.byteOffset + bodyBytes.byteLength
  );

  let obj = MsgPack.decode(buffer);
  const before = JSON.stringify(obj).length;
  obj = removeAds(obj);
  const after = JSON.stringify(obj).length;

  if (before !== after) {
    console.log(`[贴吧去广告] 已过滤广告，数据从 ${before} 压缩到 ${after} 字节`);
  }

  $done({ bodyBytes: MsgPack.encode(obj) });

} catch (e) {
  console.log('[贴吧去广告] tieba-proto 出错: ' + e.message);
  $done({});
}
