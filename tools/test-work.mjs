// 内部工作台统计函数测试：node tools/test-work.mjs
import { stats, propTags, weekly, wechatText } from "../js/work-core.js";
let fail = 0; const ok = (n, c, x = "") => { console.log((c ? "✓ " : "✗ ") + n + " " + x); if (!c) fail++; };
const now = new Date("2026-11-10T09:00:00");
const P = [
  { id: "a", status: "leased", kind: "公寓", suburb: "Carlton", beds: 1, rent_month: 2600, bond: 2400, paid_to: "2026-11-30", lease_end: "2026-12-01", mgmt_pct: 5.5, late_rate: 0, flags: { elma: { s: "issue", why: "没签" }, smoke: { s: "todo" } }, pub: { photos: ["x.jpg"] }, published: true, pub_status: "live" },
  { id: "b", status: "leased", kind: "公寓", suburb: "Carlton", beds: 2, rent_month: 3900, bond: 3600, paid_to: "2026-11-05", lease_end: "2027-06-30", mgmt_pct: null, late_rate: 0.75, flags: {}, pub: {}, published: false },
  { id: "c", status: "airbnb", kind: "公寓", suburb: "Melbourne", beds: 2, flags: {}, pub: {} },
  { id: "d", status: "vacant", kind: "联排别墅", suburb: "Clayton South", beds: 4, flags: {}, pub: {} },
  { id: "e", status: "leased", kind: "车位", rent_month: 260, paid_to: "2026-11-16", flags: {}, pub: {} },
  { id: "f", status: "archived", kind: "公寓", rent_month: 9999, flags: {}, pub: {} },
];
const S = stats(P, now);
ok("在管物业不含车位和已停管", S.managed === 4, S.managed);
ok("长租/短租/空置", S.leased === 2 && S.airbnb === 1 && S.vacant === 1);
ok("出租率 = 长租 ÷ (长租+空置)", Math.abs(S.occupancy - 66.7) < 0.01, S.occupancy);
ok("月租总额含车位、不含停管", S.rentMonth === 2600 + 3900 + 260, S.rentMonth);
ok("周租换算 = 月×12÷52", Math.abs(weekly(2600) - 600) < 1e-9);
ok("平均周租只算长租房屋", Math.abs(S.avgWeekly - (600 + 900) / 2) < 1e-9, S.avgWeekly);
ok("管理费：有费率用费率，没有按 4.4%", Math.abs(S.mgmtMonth - (2600 * .055 + 3900 * .044 + 260 * .044)) < 1e-9);
ok("押金总额", S.bonds === 6000);
ok("欠租识别", S.arrears.length === 1 && S.arrears[0].p.id === "b" && S.arrears[0].days === 5, JSON.stringify(S.arrears.map(x => [x.p.id, x.days])));
ok("欠租金额 ≈ 月租×12÷365×天数", Math.abs(S.arrears[0].amt - 3900 * 12 / 365 * 5) < 1e-6);
ok("30 天内到期", S.exp30.length === 1 && S.exp30[0].p.id === "a");
ok("常迟交", S.late.length === 1 && S.late[0].id === "b");
ok("ELMA 待补 / 安全检查待办", S.elmaIssues === 1 && S.compliance === 1);
ok("红色事项", S.issues.length === 1);
ok("propTags 欠租天数", propTags(P[1], now).arrears.days === 5);
const t = wechatText({ title: "测试", suburb: "Carlton", beds: 1, baths: 1, rentWeekly: 600, available: "尽快", highlights: ["近墨大"] }, "https://howzu.com.au/rentals.html?id=a");
ok("微信文案有标题、租金、链接", /【测试】/.test(t) && /\$600\/周/.test(t) && /howzu\.com\.au/.test(t));
ok("已租出文案不写租金", !/\$/.test(wechatText({ title: "x", status: "let", leaseEnd: "2027-02" })));
process.exit(fail ? 1 : 0);
