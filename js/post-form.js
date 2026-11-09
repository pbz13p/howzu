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
  // 日期框最早可选今天（本地时间）
  function todayISO(d) { d = d || new Date(); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  // "2026-12-01" → "12 月 1 日"（其他文字原样返回）
  function niceDate(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${+m[2]} 月 ${+m[3]} 日` : (v || ""); }
  const api = { chipState, withLease, todayISO, niceDate, LEASE_PREFIX };
  if (typeof module === "object" && module.exports) module.exports = api; else root.PostForm = api;
})(this);
