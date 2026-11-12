// 房源筛选和排序（纯函数，rentals.html 和 tools/test-filter.js 共用）
// 数据常常不全：结构化字段优先，没有就看标题/亮点/介绍里的明确说法；说"不带/没有"的不算。
(function (root) {
  const txt = x => [x.title, ...(x.highlights || []), x.desc].filter(Boolean).join(" ");
  const has = (x, yes, no) => { const t = txt(x); return yes.test(t) && !(no && no.test(t)); };
  const FEAT = {
    furn: { label: "带家具", test: x => x.furnished === true || x.furnished === "带家具" || x.furnished === "部分家具" || (x.furnished == null && has(x, /带家具|家具齐全|拎包入住|fully furnished|\bfurnished/i, /不带家具|无家具|unfurnished/i)) },
    car: { label: "有车位", test: x => x.cars > 0 || (x.cars == null && has(x, /车位|car ?park|parking/i, /无车位|没有车位|不含车位|no parking/i)) },
    pet: { label: "可养宠物", test: x => x.pets === true || x.pets === "可以" || (x.pets == null && has(x, /可养宠|宠物友好|允许宠物|可带宠物|pets? (ok|allowed|friendly)/i, /不可养宠|不能养宠|禁止宠物|no pets/i)) },
    gym: { label: "泳池/健身房", test: x => has(x, /泳池|健身房|pool|gym/i) }
  };
  // 没写明（既没说有、也没说没有）→ 待确认；泳池/健身房没写就当没有
  const UNK = {
    furn: x => x.furnished == null && !/带家具|家具|furnished/i.test(txt(x)),
    car: x => x.cars == null && !/车位|car ?park|parking/i.test(txt(x)),
    pet: x => x.pets == null && !/宠物|pets?\b/i.test(txt(x))
  };
  const unknown = (x, k) => !!(UNK[k] && UNK[k](x));
  // 不完全符合，但只差"待确认"的条件：比如筛"带家具"，房源没写家具情况
  function maybe(x, s) {
    s = s || {};
    const feat = s.feat || [];
    if (!feat.length || match(x, s)) return false;
    if (!match(x, { ...s, feat: [] })) return false;
    return feat.every(k => !FEAT[k] || FEAT[k].test(x) || unknown(x, k));
  }
  // 用数组保证顺序（对象里数字键会被排到前面）
  const RENT = [["", "周租不限"], ["500", "$500 以下"], ["700", "$700 以下"], ["900", "$900 以下"], ["900+", "$900 以上"]];
  const SORT = Object.entries({ "": "推荐排序", "new": "最新上架", "low": "租金低→高", "high": "租金高→低" });
  const area = x => String(x.suburb || "").trim() || "其他";
  const rent = x => { const n = Number(x.rentWeekly); return n > 0 ? n : null; };
  // s = { beds: ""|"1"|"2"|"3", feat: ["furn",...], area: "", rent: "" }
  function match(x, s) {
    s = s || {};
    if (s.beds === "1" && x.beds !== 1) return false;
    if (s.beds === "2" && x.beds !== 2) return false;
    if (s.beds === "3" && !(x.beds >= 3)) return false;
    for (const k of s.feat || []) if (FEAT[k] && !FEAT[k].test(x)) return false;
    if (s.area && area(x) !== s.area) return false;
    if (s.rent) { const r = rent(x); if (r == null) return false; if (s.rent === "900+" ? r < 900 : r > Number(s.rent)) return false; }
    return true;
  }
  // 排序不改原数组；租金不详（面议）的总排在后面；同分保持原顺序
  function sort(list, mode) {
    const a = list.map((x, i) => [x, i]);
    const t = x => { const d = Date.parse(x.createdAt || x.created_at || x.listedAt || ""); return isNaN(d) ? null : d; };
    const cmp = {
      low: (p, q) => (rent(p) ?? Infinity) - (rent(q) ?? Infinity),
      high: (p, q) => (rent(q) ?? -Infinity) - (rent(p) ?? -Infinity),
      new: (p, q) => (t(q) ?? -Infinity) - (t(p) ?? -Infinity)
    }[mode];
    if (cmp) a.sort((p, q) => (cmp(p[0], q[0]) || 0) || p[1] - q[1]);
    return a.map(p => p[0]);
  }
  // 区域选项：按房源数从多到少
  function areas(list) { const m = new Map(); for (const x of list) m.set(area(x), (m.get(area(x)) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }
  const count = (list, s) => list.filter(x => match(x, s)).length;
  const active = s => !!(s && (s.beds || (s.feat && s.feat.length) || s.area || s.rent));
  const api = { FEAT, RENT, SORT, match, sort, areas, count, active, area, unknown, maybe };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuFilter = api;
})(typeof window !== "undefined" ? window : this);
