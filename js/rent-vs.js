// 租金贵不贵一眼看出：房源周租 vs 本区同房型周租中位数（DFFH 租金报告，CC BY 4.0）。
// 只用政府公开中位数；区、房型、卧室数对不上，或样本少于 10 套，就不显示（不编数据）。
// 数据：data/rent_vs.json（tools/build-listing-pages.js 从 data/rent_check.json 压缩生成）。浏览器和 node 共用。
(function (root) {
  const MIN_N = 10, NEAR = 5;
  const norm = s => String(s || "").toUpperCase().replace(/\s+CBD$/, "").trim();
  // 压缩：{ q: "2026-06", g: [[区组名, { "2 bedroom flat": [中位数, 套数] }]], s: { "CARLTON": 组下标 } }
  function compact(D) {
    const g = [], s = {};
    (D.groups || []).forEach(x => {
      const r = {};
      Object.keys(x.rents || {}).forEach(k => { const v = x.rents[k]; if (v && v.now && /bedroom/.test(k)) r[k] = [v.now, v.lettings || 0]; });
      g.push([x.name, r]); (x.suburbs || []).forEach(n => { if (!(norm(n) in s)) s[norm(n)] = g.length - 1; });
    });
    return { q: D.rent_quarter || "", g, s };
  }
  // 公寓 flat / 独立屋 house；单间、联排、认不出 → null
  function ptype(x) {
    const tag = ((x.highlights || []).join(" ").match(/类型\s*(\S+)/) || [])[1];
    if (tag) return /公寓/.test(tag) ? "flat" : /独立屋/.test(tag) ? "house" : null;
    const t = String(x.title || "");
    if (/单间|房间出租|合租|\broom\b/i.test(t) || /联排|townhouse/i.test(t)) return null;
    if (/公寓|apartment|\bunit\b|studio/i.test(t)) return "flat";
    if (/独立屋|\bhouse\b/i.test(t)) return "house";
    if (/^\s*[0-9]+[A-Za-z]?\s*\/\s*\d/.test(String(x.address || ""))) return "flat";
    return null;
  }
  // 不看租金：本区同房型中位数（发房源时给房东定价参考也用它）
  function ref(x, C) {
    if (!x || !C || !C.g) return null;
    if (x.kind && x.kind !== "整套出租") return null;
    const t = ptype(x), b = Number(x.beds);
    if (!t || !(t === "flat" ? b >= 1 && b <= 3 : b >= 2 && b <= 4)) return null;
    const i = C.s[norm(x.suburb)]; if (i == null) return null;
    const m = C.g[i][1][`${b} bedroom ${t}`]; if (!m || !m[0] || m[1] < MIN_N) return null;
    return { median: m[0], n: m[1], group: C.g[i][0], label: `${b} 房${t === "flat" ? "公寓" : "独立屋"}`, q: C.q };
  }
  function match(x, C) {
    if (!x || x.status === "let" || !(Number(x.rentWeekly) > 0)) return null;
    const r = ref(x, C); if (!r) return null;
    return Object.assign({ pct: Math.round((Number(x.rentWeekly) / r.median - 1) * 100) }, r);
  }
  const short = r => r.pct <= -NEAR ? `比本区中位数低 ${-r.pct}%` : r.pct >= NEAR ? `比本区中位数高 ${r.pct}%` : "接近本区中位数";
  const qText = q => { const m = /^(\d{4})-(\d{2})$/.exec(q || ""); return m ? `截至 ${m[1]} 年 ${+m[2]} 月` : ""; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const EN = r => `${r.group} ${r.label.replace(/ 房(公寓|独立屋)/, (m, t) => "-bed " + (t === "公寓" ? "unit" : "house"))} median rent $${r.median}/wk (${r.n} new leases in the past year${r.q ? ", to " + r.q : ""}, Victorian Government DFFH Rental Report). The median covers old and new buildings; fit-out, floor and furniture all affect rent. For reference only.`;
  // 详情页一行：结论 + 中位数、样本、数据日期、出处
  function html(r) {
    if (!r) return "";
    const cls = r.pct <= -NEAR ? "lo" : r.pct >= NEAR ? "hi" : "eq";
    return `<div class="rvs ${cls}"><b>📊 ${esc(short(r))}</b><span><span data-en="${esc(EN(r))}">${esc(r.group)} ${esc(r.label)}周租中位数 $${esc(r.median)}（过去一年新租约 ${esc(r.n)} 套，${esc(qText(r.q))}，维州政府 DFFH 租金报告）。中位数包含新旧各种楼，装修、楼层、家具都会影响租金，仅供参考。</span><a href="/rents.html">查各区租金 ›</a></span></div>`;
  }
  // 发房源页：定价参考一句话（没填租金只给中位数；填了再说高/低多少）
  function postText(x, C, en) {
    const r = ref(x, C); if (!r) return "";
    const w = Number(x.rentWeekly), pct = w > 0 ? Math.round((w / r.median - 1) * 100) : null;
    if (en) {
      const lab = r.label.replace(/ 房(公寓|独立屋)/, (m, t) => "-bed " + (t === "公寓" ? "unit" : "house"));
      const base = `💡 Pricing guide: ${r.group} ${lab} median rent $${r.median}/wk (${r.n} new leases in the past year${r.q ? ", to " + r.q : ""}, Victorian Government DFFH; for reference only)`;
      return base + (pct == null ? "." : pct >= NEAR ? `. Your price is about ${pct}% higher; homes priced above the median may take longer to lease.` : pct <= -NEAR ? `. Your price is about ${-pct}% lower.` : ". Your price is close to the local median.");
    }
    const base = `💡 定价参考：${r.group} ${r.label}周租中位数 $${r.median}（过去一年新租约 ${r.n} 套，${qText(r.q)}，维州政府 DFFH，仅供参考）`;
    return base + (pct == null ? "。" : pct >= NEAR ? `，你的定价高约 ${pct}%，偏高的房子可能要等更久才租出。` : pct <= -NEAR ? `，你的定价低约 ${-pct}%。` : "，你的定价接近本区中位数。");
  }
  const CSS = `.rvs{margin:6px 0 10px;padding:9px 11px;border-radius:10px;background:#f4faf7;border:1px solid #cfe6d8;font-size:13px;line-height:1.55;color:#4a524f}.rvs b{display:block;font-size:14.5px;color:#0f6b4f;margin-bottom:2px}.rvs.hi b{color:#8a5a00}.rvs.hi{background:#fffaf0;border-color:#f0dfb8}.rvs a{color:#0f6b4f;white-space:nowrap}`;
  const api = { compact, ptype, ref, match, postText, short, html, CSS, norm, MIN_N, NEAR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RentVs = api;
})(typeof window !== "undefined" ? window : this);
