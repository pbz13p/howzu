// 自动读数自检（不连网，用假数据）：node tools/test-stats.js
const S = require("./stats.js");
let fail = 0; const ok = (n, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${n} ${x}`); if (!c) fail++; };
const now = Date.parse("2026-11-30T01:00:00Z"), d = n => new Date(now - n * 864e5).toISOString();
const pv = [
  { at: d(1), path: "/", ref: "www.google.com", mobile: true, ev: "view" },
  { at: d(2), path: "/rent/2110-spencer.html", ref: "", mobile: true, ev: "view" },
  { at: d(2), path: "/rent/2110-spencer.html", ref: "", mobile: false, ev: "call:2110-spencer@google" },
  { at: d(3), path: "/guide/study-abroad.html?utm_source=xhs", ref: "", mobile: true, ev: "view" },
  { at: d(3), path: "/guide/study-abroad.html", ref: "", mobile: true, ev: "inspect:open@xiaohongshu" },
  { at: d(3), path: "/guide/study-abroad.html", ref: "", mobile: true, ev: "callback:代看房@xiaohongshu" },
  { at: d(4), path: "/building/eureka-tower.html", ref: "", mobile: true, ev: "view" },
  { at: d(4), path: "/building/eureka-tower.html", ref: "", mobile: true, ev: "alert:sub@direct" },
  { at: d(5), path: "/rentals.html?utm_source=alert", ref: "", mobile: true, ev: "view" },
  { at: d(5), path: "/rent/3005.html", ref: "", mobile: true, ev: "related:x@direct" },
  { at: d(6), path: "404 /old", ref: "", mobile: true, ev: "view" },
  { at: d(40), path: "/", ref: "", mobile: true, ev: "view" }, // 超出 30 天
];
const L = (kind, days, o = {}) => Object.assign({ kind, status: "pending", created_at: d(days), suburb: null, beds: null, rent_weekly: null }, o);
const leads = [
  L("求租需求", 1, { suburb: "Box Hill", beds: 2, rent_weekly: 600, contact_phone: "0412345678", description: "张三 微信 abc123" }),
  L("求租需求", 2, { suburb: "Box Hill", beds: 2, rent_weekly: 650 }),
  L("求租需求", 3, { suburb: "Box Hill", beds: 2, rent_weekly: 700 }),
  L("求租需求", 4, { suburb: "Clayton", beds: 1, rent_weekly: 400 }),
  L("求租需求", 50, { suburb: "Carlton", beds: 0, rent_weekly: 300 }),
  L("求租需求", 70, { suburb: "Carlton", beds: 0, rent_weekly: 300 }),
  L("代看房", 3), L("回电请求", 3), L("找房订阅", 45),
];
const own = [{ id: "a", status: "live" }, { id: "b", status: "live" }, { id: "c", status: "let" }];
const pub = [{ id: "a", status: "live", kind: "整套出租" }, { id: "z", status: "live", kind: "整套出租" }];
const s = S.summarize({ pv, leads, own, pub, now });
ok("浏览只算 30 天内、去掉 404", s.views30 === 5, `(${s.views30})`);
ok("询盘只算联系动作（电话、回电），不算相关房源/订阅", s.enquiries30 === 2, `(${s.enquiries30})`);
ok("在线房源去重（自管 2 + 房东 1）", s.liveListings === 3 && s.livePublic === 1);
ok("开学季专区访问 / 代看房入口 / 询盘", s.studyAbroad.views === 1 && s.studyAbroad.inspectOpen === 1 && s.studyAbroad.enquiries === 1 && s.studyAbroad.inspectRows === 1);
ok("楼盘订阅", s.building.views === 1 && s.building.subs === 1);
ok("找房订阅人数不受 30 天限制、订阅邮件浏览", s.alerts.subscribers === 1 && s.alerts.views === 1);
ok("询盘渠道", s.enquiryChannels.length === 2 && s.enquiryChannels.some(([k]) => k === "Google"));
ok("需求热度：Box Hill 2房 3 条单列，中位数 $650", s.demand60.cells.length === 1 && s.demand60.cells[0].n === 3 && s.demand60.cells[0].budgetMedian === 650);
ok("需求热度：不足 3 条的并入其它；超 60 天不算", s.demand60.otherN === 2 && s.demand60.total === 5);
const js = JSON.stringify(s);
ok("输出里没有电话、微信、姓名、原文", !/0412345678|abc123|张三|description|contact/.test(js));
const md0 = "# x\n\n| 周（周一） | 月访问量（近 30 天浏览） | b |\n|---|---|---|\n| 2026-11-09 | 1 | 2 |\n\n## 其它\n";
const md1 = S.updateMetrics(md0, s, true), md2 = S.updateMetrics(md1, s, true);
ok("METRICS 自动段落插在主表前", md1.indexOf("auto-stats:start") < md1.indexOf("| 周（周一）"));
ok("周一追加一行，重复运行不重复", (md2.match(/（自动） \|/g) || []).length === 1 && md2.split("auto-stats:start").length === 2);
ok("追加行在主表内", /\| 2026-11-09 \| 1 \| 2 \|\n\| 2026-11-30（自动）/.test(md1));
ok("非周一不追加", !/（自动） \|/.test(S.updateMetrics(md0, s, false)));
console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
