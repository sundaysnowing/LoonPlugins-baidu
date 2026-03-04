/**
 * 百度贴吧 - 信息流广告过滤脚本 v4.0
 * 支持 MessagePack 二进制响应格式
 * 过滤首页/关注页/推荐流中的广告卡片（精选推荐、原生广告等）
 */

// ── MessagePack 轻量解码/编码器 ───────────────────────────
const MsgPack = (() => {
  function decode(buffer) {
    const view = new DataView(buffer);
    let offset = 0;

    function readUint8()  { return view.getUint8(offset++); }
    function readUint16() { const v = view.getUint16(offset);  offset += 2; return v; }
    function readUint32() { const v = view.getUint32(offset);  offset += 4; return v; }
    function readInt8()   { const v = view.getInt8(offset);    offset += 1; return v; }
    function readInt16()  { const v = view.getInt16(offset);   offset += 2; return v; }
    function readInt32()  { const v = view.getInt32(offset);   offset += 4; return v; }
    function readFloat32(){ const v = view.getFloat32(offset); offset += 4; return v; }
    function readFloat64(){ const v = view.getFloat64(offset); offset += 8; return v; }
    function readInt64()  {
      const hi = view.getUint32(offset); offset += 4;
      const lo = view.getUint32(offset); offset += 4;
      return hi * 4294967296 + lo;
    }
    function readStr(len) {
      const bytes = new Uint8Array(buffer, offset, len);
      offset += len;
      return new TextDecoder('utf-8').decode(bytes);
    }
    function readBin(len) {
      const bytes = new Uint8Array(buffer, offset, len);
      offset += len;
      return bytes;
    }
    function readArray(len) {
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(readValue());
      return arr;
    }
    function readMap(len) {
      const obj = {};
      for (let i = 0; i < len; i++) { const k = readValue(); obj[k] = readValue(); }
      return obj;
    }
    function readValue() {
      const b = readUint8();
      if ((b & 0x80) === 0) return b;
      if ((b & 0xf0) === 0x80) return readMap(b & 0x0f);
      if ((b & 0xf0) === 0x90) return readArray(b & 0x0f);
      if ((b & 0xe0) === 0xa0) return readStr(b & 0x1f);
      if ((b & 0xe0) === 0xe0) return b - 256;
      switch (b) {
        case 0xc0: return null;
        case 0xc2: return false;
        case 0xc3: return true;
        case 0xca: return readFloat32();
        case 0xcb: return readFloat64();
        case 0xcc: return readUint8();
        case 0xcd: return readUint16();
        case 0xce: return readUint32();
        case 0xcf: return readInt64();
        case 0xd0: return readInt8();
        case 0xd1: return readInt16();
        case 0xd2: return readInt32();
        case 0xd3: return readInt64();
        case 0xd9: return readStr(readUint8());
        case 0xda: return readStr(readUint16());
        case 0xdb: return readStr(readUint32());
        case 0xdc: return readArray(readUint16());
        case 0xdd: return readArray(readUint32());
        case 0xde: return readMap(readUint16());
        case 0xdf: return readMap(readUint32());
        case 0xc4: return readBin(readUint8());
        case 0xc5: return readBin(readUint16());
        case 0xc6: return readBin(readUint32());
        default: return null;
      }
    }
    return readValue();
  }

  function encode(value) {
    const chunks = [];
    function w8(v)   { chunks.push(new Uint8Array([v & 0xff])); }
    function w16(v)  { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v);  chunks.push(b); }
    function w32(v)  { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v);  chunks.push(b); }
    function wi8(v)  { const b = new Uint8Array(1); new DataView(b.buffer).setInt8(0, v);    chunks.push(b); }
    function wi16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v);   chunks.push(b); }
    function wi32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v);   chunks.push(b); }
    function wf64(v) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); chunks.push(b); }

    function wStr(s) {
      const enc = new TextEncoder().encode(s);
      const l = enc.length;
      if (l <= 31)         w8(0xa0 | l);
      else if (l <= 0xff)  { w8(0xd9); w8(l); }
      else if (l <= 0xffff){ w8(0xda); w16(l); }
      else                 { w8(0xdb); w32(l); }
      chunks.push(enc);
    }

    function wVal(v) {
      if (v === null || v === undefined) { w8(0xc0); return; }
      if (v === false) { w8(0xc2); return; }
      if (v === true)  { w8(0xc3); return; }
      if (typeof v === 'number') {
        if (Number.isInteger(v)) {
          if (v >= 0) {
            if (v <= 127)        w8(v);
            else if (v <= 0xff)  { w8(0xcc); w8(v); }
            else if (v <= 0xffff){ w8(0xcd); w16(v); }
            else                 { w8(0xce); w32(v); }
          } else {
            if (v >= -32)         w8(v & 0xff);
            else if (v >= -128)  { w8(0xd0); wi8(v); }
            else if (v >= -32768){ w8(0xd1); wi16(v); }
            else                 { w8(0xd2); wi32(v); }
          }
        } else { w8(0xcb); wf64(v); }
        return;
      }
      if (typeof v === 'string') { wStr(v); return; }
      if (v instanceof Uint8Array) {
        const l = v.length;
        if (l <= 0xff)        { w8(0xc4); w8(l); }
        else if (l <= 0xffff) { w8(0xc5); w16(l); }
        else                  { w8(0xc6); w32(l); }
        chunks.push(v); return;
      }
      if (Array.isArray(v)) {
        const l = v.length;
        if (l <= 15)          w8(0x90 | l);
        else if (l <= 0xffff) { w8(0xdc); w16(l); }
        else                  { w8(0xdd); w32(l); }
        v.forEach(wVal); return;
      }
      if (typeof v === 'object') {
        const keys = Object.keys(v);
        const l = keys.length;
        if (l <= 15)          w8(0x80 | l);
        else if (l <= 0xffff) { w8(0xde); w16(l); }
        else                  { w8(0xdf); w32(l); }
        keys.forEach(k => { wStr(k); wVal(v[k]); }); return;
      }
    }

    wVal(value);
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    chunks.forEach(c => { out.set(c, pos); pos += c.length; });
    return out;
  }

  return { decode, encode };
})();

// ── 广告识别规则 ──────────────────────────────────────────

const adTypeKeywords = [
  'ad', 'ad_pb', 'ad_thread', 'ad_native', 'ad_card',
  'feed_ad', 'native_ad', 'banner_ad', 'promote',
  'promotion', 'promoted', 'sponsored', 'cpa', 'cpc', 'cpm',
  'advert', 'advertisement', 'hot_push', 'hot_rec',
  'jx_rec', 'jingxuan', 'selected_push', 'hot_recommend'
];
const adFlagFields = [
  'is_ad', 'isAd', 'ad_flag', 'adFlag', 'show_ad',
  'is_promotion', 'is_promote', 'is_sponsored',
  'is_hot_push', 'is_rec', 'is_recommend_ad',
  'has_ad', 'ad_mark', 'ad_label'
];
const adExclusiveFields = [
  'ad_pb', 'ad_info', 'ad_extra', 'ad_src', 'ad_id',
  'creative_id', 'ecpm', 'landing_page',
  'download_url', 'app_download', 'market_info', 'click_url'
];
const fakeAuthorNames = [
  '精选推荐', '精选热推', '热门推荐', '官方推荐',
  '贴吧推荐', '为你推荐', '广告', '推广'
];
const adCtaTexts = [
  '立即查看', '立即下载', '立即体验', '立即安装',
  '立即领取', '点击查看', '马上查看', '去看看',
  '免费领取', '立即预约', '立即参与'
];

function deepContainsText(obj, targets, depth = 3) {
  if (depth <= 0 || !obj) return false;
  if (typeof obj === 'string') return targets.some(t => obj.includes(t));
  if (Array.isArray(obj)) return obj.some(i => deepContainsText(i, targets, depth - 1));
  if (typeof obj === 'object') return Object.values(obj).some(v => deepContainsText(v, targets, depth - 1));
  return false;
}

function isAdItem(item) {
  if (!item || typeof item !== 'object') return false;
  for (const f of adExclusiveFields)
    if (item[f] !== undefined && item[f] !== null && item[f] !== '') return true;
  for (const f of adFlagFields) {
    const v = item[f];
    if (v === 1 || v === true || v === '1' || v === 'true') return true;
  }
  for (const f of ['type','thread_type','item_type','card_type','content_type','feed_type','post_type','rec_type']) {
    if (item[f] !== undefined) {
      const v = String(item[f]).toLowerCase();
      if (adTypeKeywords.some(kw => v === kw || v.includes(kw))) return true;
    }
  }
  for (const f of ['author_name','nickname','name','show_nickname','from_nickname'])
    if (item[f] && typeof item[f] === 'string' && fakeAuthorNames.some(n => item[f].includes(n))) return true;
  for (const f of ['btn_text','button_text','cta_text','action_text','link_text'])
    if (item[f] && typeof item[f] === 'string' && adCtaTexts.some(c => item[f].includes(c))) return true;
  if (deepContainsText(item.buttons, adCtaTexts) ||
      deepContainsText(item.action,  adCtaTexts) ||
      deepContainsText(item.ext,     adCtaTexts)) return true;
  for (const f of ['title','desc','abstract','label','tag'])
    if (item[f] && typeof item[f] === 'string' &&
        ['广告','推广','精选热推','热推','Ad','Sponsored'].some(m => item[f].includes(m))) return true;
  for (const f of ['extend','extra','info','ext','meta'])
    if (item[f] && typeof item[f] === 'object' && isAdItem(item[f])) return true;
  return false;
}

function removeAds(data) {
  if (Array.isArray(data))
    return data.filter(i => !isAdItem(i)).map(i => removeAds(i));
  if (data && typeof data === 'object') {
    const out = {};
    for (const k of Object.keys(data)) {
      if (adTypeKeywords.some(kw => k.toLowerCase() === kw)) continue;
      out[k] = removeAds(data[k]);
    }
    return out;
  }
  return data;
}

// ── 主逻辑 ────────────────────────────────────────────────

try {
  const bodyBytes = $response.bodyBytes;
  if (!bodyBytes || bodyBytes.byteLength === 0) { $done({}); }

  const buffer = bodyBytes.buffer.slice(
    bodyBytes.byteOffset,
    bodyBytes.byteOffset + bodyBytes.byteLength
  );

  let obj = MsgPack.decode(buffer);
  obj = removeAds(obj);
  const encoded = MsgPack.encode(obj);
  $done({ bodyBytes: encoded });

} catch (e) {
  console.log('[贴吧去广告] feedAd 出错: ' + e.message);
  $done({});
}
