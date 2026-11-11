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
      tags: (x.highlights || []).slice(0, 4)
    };
  }
  const api = { chipState, withLease, withTag, move, bondText, todayISO, niceDate, previewLines, LEASE_PREFIX };
  if (typeof module === "object" && module.exports) module.exports = api; else root.PostForm = api;
})(this);
