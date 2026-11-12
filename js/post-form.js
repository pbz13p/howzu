/* 发房源表单的纯函数（浏览器和 node 测试共用） */
(function (root) {
  // 草稿里保存的选项 → 每个按钮是否选中。保存的文字找不到（选项改过名）就保留页面默认值。
  function chipState(texts, saved, single, defaults) {
    if (!Array.isArray(saved)) return defaults.slice();
    const hit = texts.map(t => saved.includes(t));
    if (single && !hit.some(Boolean)) return defaults.slice();
    if (single) { const i = hit.indexOf(true); return texts.map((_, j) => j === i); }
    return hit;
  }
  // 租期等结构化选项放进已有的 highlights 文本数组（不改数据库表结构）
  const LEASE_PREFIX = "租期 ";
  function withLease(highlights, lease) {
    const h = (highlights || []).filter(x => !String(x).startsWith(LEASE_PREFIX));
    return lease ? [LEASE_PREFIX + lease, ...h] : h;
  }
  // 通用：某类结构化标签（"押金 4 周"、"看房 视频看房"）放进 highlights，同前缀只留一个
  function withTag(highlights, prefix, value) {
    const h = (highlights || []).filter(x => !String(x).startsWith(prefix));
    return value ? [prefix + value, ...h] : h;
  }
  // 房东定好的开放看房时间：datetime-local 的值（"2026-11-15T11:00"）→ 标签「开放看房 2026-11-15 11:00」。
  // 去掉旧的同类标签、坏值和重复，按时间排序，最多 3 个。
  const SLOT_PREFIX = "开放看房 ";
  function withSlots(highlights, values) {
    const h = (highlights || []).filter(x => !String(x).startsWith(SLOT_PREFIX));
    const v = [...new Set((values || []).map(s => String(s || "").trim().replace("T", " ").slice(0, 16)).filter(s => /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(s)))].sort().slice(0, 3);
    return [...v.map(s => SLOT_PREFIX + s), ...h];
  }
  // 照片换顺序：把第 from 张挪到第 to 个位置（返回新数组）
  function move(arr, from, to) {
    const a = arr.slice(); if (from === to || from < 0 || to < 0 || from >= a.length || to >= a.length) return a;
    const [x] = a.splice(from, 1); a.splice(to, 0, x); return a;
  }
  // 押金金额提示：周租 × 周数
  function bondText(weekly, choice) {
    const w = +weekly || 0, m = /^(\d+) 周/.exec(choice || "");
    return m && w ? `押金 ≈ $${(w * +m[1]).toLocaleString("en-AU")}` : "";
  }
  // 日期框最早可选今天（本地时间）
  function todayISO(d) { d = d || new Date(); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  // "2026-12-01" → "12 月 1 日"（其他文字原样返回）
  function niceDate(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${+m[2]} 月 ${+m[3]} 日` : (v || ""); }
  // 提交前预览：把要提交的房源变成"上线后卡片上显示的几行字"
  function previewLines(x) {
    const room = x.kind === "单间出租" ? "单间" : [x.beds + " 房", x.baths + " 卫", x.cars ? x.cars + " 车位" : ""].filter(Boolean).join(" · ");
    const av = x.available === "马上" ? "马上入住" : x.available && x.available !== "选日期" ? niceDate(x.available) + "入住" : "";
    return {
      price: x.rent_weekly ? "$" + x.rent_weekly : "租金面议",
      title: x.title || "",
      facts: [room, x.suburb].filter(Boolean).join(" · "),
      meta: [av, x.furnished].filter(Boolean).join(" · "),
      tags: splitTags(x.highlights).real.filter(h => !h.startsWith(SLOT_PREFIX)).slice(0, 4)
    };
  }
  // 结构化标签（类型/押金/租期/看房/宠物/楼层）和真正的“亮点”分开：自动写标题只用真亮点，结构化的放进“房子”信息里
  const INFO_RE = /^(类型|押金|租期|看房|开放看房|楼层) |^不?可养宠物$/;
  function splitTags(h) { const a = (h || []).map(String); return { real: a.filter(x => !INFO_RE.test(x)), info: a.filter(x => INFO_RE.test(x)) }; }
  // 旧草稿：设施以前混在“亮点”里（有电梯 / 有阳台 / 泳池/健身房），换成新的“设施”选项
  const OLD_AMEN = { "有电梯": ["电梯"], "有阳台": ["阳台"], "泳池/健身房": ["泳池", "健身房"] };
  function oldAmen(c) { return Array.isArray(c && c.amen) ? c.amen : (c && c.highlights || []).flatMap(h => OLD_AMEN[h] || []); }
  const api = { oldAmen, splitTags, chipState, withLease, withTag, withSlots, SLOT_PREFIX, move, bondText, todayISO, niceDate, previewLines, LEASE_PREFIX };
  if (typeof module === "object" && module.exports) module.exports = api; else root.PostForm = api;
})(this);
