// 内部工作台的纯计算函数（不碰网络/页面），方便测试：node tools/test-work.mjs
export const DAY = 864e5;
const toDate = s => s ? new Date(String(s).slice(0, 10) + "T00:00:00") : null;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
export const weekly = m => m == null ? null : m * 12 / 52;
export const money = n => n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-AU");
export const fmtDate = s => { const d = toDate(s); return d ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` : "—"; };
export const DEFAULT_MGMT_PCT = 4.4;

const isLongTerm = p => p.status === "leased" && p.kind !== "车位";
const counts = p => p.status !== "archived" && p.kind !== "车位";

// 一套房的标签：欠租、到期、待办……
export function propTags(p, now = new Date()) {
  const chips = [], issues = [];
  const st = { leased: ["长租在租", "ok"], vacant: ["空置", "bad"], airbnb: ["短租", "blue"], archived: ["不再管理", ""] }[p.status] || [p.status, ""];
  chips.push({ t: st[0], c: st[1] });
  let arrears = null, expDays = null;
  if (p.status === "leased" && p.paid_to) {
    const d = daysBetween(toDate(p.paid_to), now);
    if (d > 0) { arrears = { days: d, amt: (p.rent_month || 0) * 12 / 365 * d }; chips.push({ t: `欠租 ${d} 天`, c: "bad" }); }
    else chips.push({ t: `交到 ${fmtDate(p.paid_to)}`, c: "" });
  }
  if (p.status === "leased" && p.lease_end) {
    expDays = daysBetween(now, toDate(p.lease_end));
    if (expDays < 0) chips.push({ t: "租约已过期", c: "bad" });
    else if (expDays <= 90) chips.push({ t: `${expDays} 天后到期`, c: expDays <= 30 ? "bad" : "warn" });
    else chips.push({ t: `到期 ${fmtDate(p.lease_end)}`, c: "" });
  }
  if (p.late_rate != null && p.late_rate >= 0.5) chips.push({ t: "常迟交", c: "warn" });
  const F = p.flags || {}, NAMES = { lease: "租约", rent: "租金", elma: "ELMA", rtba: "押金", insp: "检查", smoke: "烟雾报警", gas: "燃气", elec: "电气", oc: "物业费" };
  for (const [k, v] of Object.entries(F)) if (v && v.s === "issue") { issues.push({ k, t: `${NAMES[k] || k}：${v.why || ""}` }); chips.push({ t: NAMES[k] || k, c: "bad" }); }
  const safetyTodo = ["smoke", "gas", "elec"].filter(k => F[k] && !["ok", "na", "owner"].includes(F[k].s)).length;
  if (safetyTodo) chips.push({ t: `安全检查待办 ${safetyTodo}`, c: "warn" });
  if (!(p.pub?.photos || []).length && p.kind !== "车位") chips.push({ t: "缺照片", c: "" });
  return { chips, issues, arrears, expDays, safetyTodo };
}

export function stats(props, now = new Date()) {
  const act = props.filter(p => p.status !== "archived");
  const homes = act.filter(counts);
  const leased = homes.filter(isLongTerm);
  const S = {
    managed: homes.length,
    leased: leased.length,
    airbnb: homes.filter(p => p.status === "airbnb").length,
    vacant: homes.filter(p => p.status === "vacant").length,
    carparks: act.filter(p => p.kind === "车位").length,
  };
  const lettable = S.leased + S.vacant;
  S.occupancy = lettable ? Math.round(S.leased / lettable * 1000) / 10 : 0;
  const rented = act.filter(p => p.status === "leased" && p.rent_month);
  S.rentMonth = rented.reduce((a, p) => a + p.rent_month, 0);
  S.avgWeekly = leased.filter(p => p.rent_month).length ? leased.filter(p => p.rent_month).reduce((a, p) => a + weekly(p.rent_month), 0) / leased.filter(p => p.rent_month).length : null;
  S.mgmtTotal = rented.length; S.mgmtKnown = rented.filter(p => p.mgmt_pct != null).length;
  S.mgmtMonth = rented.reduce((a, p) => a + p.rent_month * (p.mgmt_pct ?? DEFAULT_MGMT_PCT) / 100, 0);
  S.bonds = act.filter(p => p.status === "leased").reduce((a, p) => a + (p.bond || 0), 0);
  const tagged = act.map(p => ({ p, t: propTags(p, now) }));
  S.arrears = tagged.filter(x => x.t.arrears).map(x => ({ p: x.p, ...x.t.arrears })).sort((a, b) => b.days - a.days);
  S.arrearsAmt = S.arrears.reduce((a, x) => a + x.amt, 0);
  const exp = tagged.filter(x => x.t.expDays != null && x.t.expDays >= 0).map(x => ({ p: x.p, days: x.t.expDays })).sort((a, b) => a.days - b.days);
  S.exp30 = exp.filter(x => x.days <= 30); S.exp90 = exp.filter(x => x.days <= 90); S.exp180 = exp.filter(x => x.days <= 180);
  S.late = act.filter(p => p.late_rate != null && p.late_rate >= 0.5).sort((a, b) => b.late_rate - a.late_rate);
  S.issues = tagged.flatMap(x => x.t.issues.map(i => ({ p: x.p, t: i.t })));
  S.compliance = tagged.reduce((a, x) => a + x.t.safetyTodo, 0);
  S.complianceProps = tagged.filter(x => x.t.safetyTodo).length;
  S.elmaIssues = act.filter(p => p.flags?.elma && ["issue", "todo"].includes(p.flags.elma.s)).length;
  S.pubLive = act.filter(p => p.published && p.pub?.status !== "let").length;
  S.pubLet = act.filter(p => p.published && p.pub?.status === "let").length;
  S.unpublished = homes.filter(p => !p.published).length;
  const group = keyFn => {
    const m = new Map();
    for (const p of homes) { const k = keyFn(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    return [...m].map(([k, a]) => { const r = a.filter(p => p.status === "leased" && p.rent_month); return { k, n: a.length, avgW: r.length ? r.reduce((s, p) => s + weekly(p.rent_month), 0) / r.length : null }; }).sort((a, b) => b.n - a.n);
  };
  S.bySuburb = group(p => p.suburb || "其他");
  S.byBeds = group(p => p.beds ? `${p.beds} 房` : "其他");
  S.lastUpdate = props.reduce((a, p) => (p.updated_at || "") > a ? p.updated_at : a, "");
  return S;
}

// 微信转发文案（纯文字，不含门牌号）
export function wechatText(u, link) {
  const lines = [];
  lines.push(`【${u.title || "好租房源"}】`);
  const meta = [u.suburb, u.beds != null ? `${u.beds} 房 ${u.baths ?? "?"} 卫` : "", u.cars ? `${u.cars} 车位` : ""].filter(Boolean).join(" · ");
  if (meta) lines.push(meta);
  if (u.status === "let") lines.push("目前已租出" + (u.leaseEnd ? `（现租约到 ${+u.leaseEnd.slice(0, 4)} 年 ${+u.leaseEnd.slice(5, 7)} 月）` : "") + "，同楼/附近有房可帮你留意");
  else lines.push(`💰 ${u.rentWeekly ? `$${u.rentWeekly}/周` : "租金面议"}${u.available ? ` · 🗓 ${u.available}入住` : ""}`);
  if ((u.highlights || []).length) lines.push("✨ " + u.highlights.slice(0, 4).join(" / "));
  if (link) lines.push("👉 照片和详情：" + link);
  return lines.join("\n");
}
