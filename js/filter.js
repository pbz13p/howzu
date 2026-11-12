/* 好租 · 房源筛选和排序（纯函数，浏览器和 node 测试共用） */
(function (root) {
  const txt = x => [x.title, ...(x.highlights || []), x.desc].filter(Boolean).join(" ");
  const isLet = x => x.status === "let";
  const isNow = x => !isLet(x) && /尽快|马上|即|now/i.test(x.available || "");
  // 结构化字段优先；没有时只认介绍里“明确肯定”的说法，否定说法不算
  const FEAT = {
    furn: { label: "带家具", field: x => x.furnished, yes: /带家具|配家具|全家具|家具齐全|拎包入住|fully furnished|\bfurnished/i, no: /不带家具|无家具|空房|unfurnished/i },
    car: { label: "有车位", field: x => (x.cars == null ? null : x.cars > 0), yes: /车位|停车位|carpark|car park|parking/i, no: /无车位|没有车位|不含车位|no (car ?park|parking)/i },
    pet: { label: "可养宠物", field: x => x.pets, yes: /可养宠物|宠物友好|允许宠物|pets? (ok|allowed|friendly)/i, no: /不可养宠物|不能养宠物|禁止宠物|no pets?/i },
  };
  function hasFeat(x, k) {
    const f = FEAT[k]; if (!f) return false;
    const v = f.field(x);
    if (v === true || v === false) return v;
    const t = txt(x);
    if (f.no.test(t)) return false;
    return f.yes.test(t);
  }
  const PRICES = [["", "周租不限"], ["0-500", "$500 以下"], ["0-700", "$700 以下"], ["0-900", "$900 以下"], ["900-", "$900 以上"]];
  function inPrice(x, p) {
    if (!p) return true;
    const r = +x.rentWeekly; if (!r) return false; // 面议不进任何价位
    const [a, b] = p.split("-");
    return r >= (+a || 0) && (b === "" || b == null ? true : r <= +b);
  }
  const areaOf = x => (x.suburb || (x.address || "").split(",").slice(-1)[0].replace(/VIC\s*\d+/, "").trim() || "墨尔本");
  const empty = () => ({ when: "", beds: "", feat: [], area: "", price: "", fav: false, sort: "rec" });
  function match(x, S, isFav) {
    if (S.when === "now" && !isNow(x)) return false;
    if (S.when === "later" && (isNow(x) || isLet(x))) return false;
    if (S.beds === "1" && x.beds !== 1) return false;
    if (S.beds === "2" && !(x.beds >= 2)) return false;
    for (const k of S.feat || []) if (!hasFeat(x, k)) return false;
    if (S.area && areaOf(x) !== S.area) return false;
    if (!inPrice(x, S.price)) return false;
    if (S.fav && !(isFav && isFav(x))) return false;
    return true;
  }
  const active = S => !!(S.when || S.beds || (S.feat && S.feat.length) || S.area || S.price || S.fav);
  const SORTS = [["rec", "推荐"], ["new", "最新上架"], ["low", "租金低→高"], ["high", "租金高→低"]];
  function sort(list, mode) {
    const a = list.map((x, i) => [x, i]);
    const ts = x => Date.parse(x.listedAt || x.created_at || x.createdAt || "") || 0;
    const rent = x => +x.rentWeekly || 0;
    a.sort(([x, i], [y, j]) => {
      const d = (isLet(x) ? 1 : 0) - (isLet(y) ? 1 : 0); if (d) return d; // 已租出永远在后面
      if (mode === "new") return (ts(y) - ts(x)) || (i - j);
      if (mode === "low" || mode === "high") {
        const rx = rent(x), ry = rent(y);
        if (!rx !== !ry) return rx ? -1 : 1; // 面议排最后
        return (mode === "low" ? rx - ry : ry - rx) || (i - j);
      }
      return i - j;
    });
    return a.map(p => p[0]);
  }
  // 区域选项：按在租房源数从多到少（数组，保证顺序）
  function areas(list) {
    const m = new Map();
    for (const x of list) if (!isLet(x)) { const k = areaOf(x); m.set(k, (m.get(k) || 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  // 点了某个选项后会剩几套（在其它条件不变的前提下）
  function countWith(list, S, patch, isFav) {
    const T = Object.assign({}, S, patch);
    return list.filter(x => !isLet(x) && match(x, T, isFav)).length;
  }
  const api = { FEAT, PRICES, SORTS, hasFeat, inPrice, areaOf, empty, match, active, sort, areas, countWith, isNow };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HowzuFilter = api;
})(typeof window !== "undefined" ? window : globalThis);
