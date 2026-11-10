// 内部工作台统计函数测试：node tools/test-work.mjs
import { stats, propTags, weekly, wechatText } from "../js/work-core.js";
import { fromTracker, clean } from "../js/work-sync.js";
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
ok("管理费：只按实际费率算，缺费率的单独列出", Math.abs(S.mgmtMonth - 2600 * .055) < 1e-9 && S.mgmtMissing.length === 2);
ok("押金总额", S.bonds === 6000);
ok("欠租识别", S.arrears.length === 1 && S.arrears[0].p.id === "b" && S.arrears[0].days === 5, JSON.stringify(S.arrears.map(x => [x.p.id, x.days])));
ok("欠租金额 = 欠了几期 × 月租（交到日一过就欠一整期）", S.arrears[0].periods === 1 && S.arrears[0].amt === 3900);
ok("30 天内到期", S.exp30.length === 1 && S.exp30[0].p.id === "a");
ok("常迟交", S.late.length === 1 && S.late[0].id === "b");
ok("ELMA 待补 / 安全检查待办", S.elmaIssues === 1 && S.compliance === 1);
ok("红色事项", S.issues.length === 1);
ok("propTags 欠租天数", propTags(P[1], now).arrears.days === 5);
const t = wechatText({ title: "测试", suburb: "Carlton", beds: 1, baths: 1, rentWeekly: 600, available: "尽快", highlights: ["近墨大"] }, "https://howzu.com.au/rentals.html?id=a");
ok("微信文案有标题、租金、链接", /【测试】/.test(t) && /\$600\/周/.test(t) && /howzu\.com\.au/.test(t));
ok("已租出文案不写租金", !/\$/.test(wechatText({ title: "x", status: "let", leaseEnd: "2027-02" })));
const tr = fromTracker({ id: "x1", data: { addr: "1906/371 Little Lonsdale St, Melbourne", beds: 2, baths: 2, cars: 0, rentAmt: 3694, bondAmt: 3400, leaseEnd: "2027-05-30", paidTo: "2026-10-30", owner: "O", tenant: "不该同步", payHabit: { lateRate: 1 }, elma: { status: "issue", why: "Let 1wk · Mgmt 5.5% · Ads $330" }, oc: { status: "ok", note: "BPAY 96503 / 27282899790000202353", why: "#1726 due 01/12 ref 27282899790000202353" }, rent: { status: "issue", note: "未付 $3,694" } } });
ok("tracker 同步：基本字段", tr.rent_month === 3694 && tr.paid_to === "2026-10-30" && tr.suburb === "Melbourne" && tr.late_rate === 1 && tr.status === "leased");
ok("tracker 同步：从 ELMA 读管理费率", tr.mgmt_pct === 5.5);
ok("tracker 同步：不带租客名字", !JSON.stringify(tr).includes("不该同步"));
ok("tracker 同步：长数字参考号被抹掉", !JSON.stringify(tr).includes("27282899790000202353"), tr.flags.oc.why);
ok("tracker 同步：短租识别", fromTracker({ id: "a", data: { addr: "x, Melbourne", lease: { status: "na" }, rent: { status: "na" } } }).status === "airbnb");
ok("tracker 同步：停管识别", fromTracker({ id: "a", data: { addr: "x", archived: true } }).status === "archived");
ok("tracker 同步：车位", fromTracker({ id: "p", data: { addr: "Car park P227 & Storage, 23 Mackenzie St" } }).kind === "车位");
process.exit(fail ? 1 : 0);
