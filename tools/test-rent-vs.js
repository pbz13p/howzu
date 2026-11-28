// 测试：房源周租 vs 本区同房型中位数（js/rent-vs.js）。运行：node tools/test-rent-vs.js
const fs = require("fs"), path = require("path"), RV = require("../js/rent-vs.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) fail++; };
const D = { rent_quarter: "2026-06", groups: [
  { name: "CBD-St Kilda Rd", suburbs: ["MELBOURNE"], rents: { "1 bedroom flat": { now: 580, lettings: 5828 }, "2 bedroom flat": { now: 750, lettings: 6461 }, "All properties": { now: 680, lettings: 1 } } },
  { name: "Carlton-Parkville", suburbs: ["CARLTON", "PARKVILLE"], rents: { "1 bedroom flat": { now: 530, lettings: 300 }, "3 bedroom house": { now: 990, lettings: 6 }, "2 bedroom house": { now: 750, lettings: 40 } } }] };
const C = RV.compact(D);
const x = { status: "live", title: "Spencer St · 两房一卫公寓", address: "138 Spencer St", suburb: "Melbourne CBD", beds: 2, rentWeekly: 810 };
const r = RV.match(x, C);
ok("CBD 两房公寓 $810 vs 中位数 $750 → 高 8%", r && r.pct === 8 && r.median === 750 && RV.short(r) === "比本区中位数高 8%");
ok("低于中位数", RV.short(RV.match({ ...x, rentWeekly: 690 }, C)) === "比本区中位数低 8%");
ok("±5% 以内写“接近”", RV.short(RV.match({ ...x, rentWeekly: 720 }, C)) === "接近本区中位数");
ok("Carlton 对上 Carlton-Parkville 组", RV.match({ ...x, suburb: "Carlton", beds: 1, rentWeekly: 580 }, C).group === "Carlton-Parkville");
ok("没这个区 → 不显示", RV.match({ ...x, suburb: "Nowhere" }, C) === null);
ok("样本少于 10 套 → 不显示", RV.match({ ...x, suburb: "Carlton", beds: 3, title: "独立屋" }, C) === null);
ok("独立屋按 house 对比", RV.match({ ...x, suburb: "Parkville", beds: 2, title: "两房独立屋", rentWeekly: 750 }, C).pct === 0);
ok("单间、转租等非整套 → 不显示", RV.match({ ...x, title: "CBD 单间出租" }, C) === null && RV.match({ ...x, kind: "单间出租" }, C) === null);
ok("联排 → 不显示（DFFH 没有这个房型）", RV.match({ ...x, title: "", highlights: ["类型 联排别墅"] }, C) === null);
ok("发房源标签“类型 公寓”能认出", RV.ptype({ title: "好房", highlights: ["类型 公寓"] }) === "flat");
ok("单元号地址认作公寓", RV.ptype({ title: "好房", address: "4803B/639 Little Lonsdale St" }) === "flat");
ok("认不出房型 → 不显示，不猜", RV.match({ ...x, title: "好房出租", address: "12 Smith St" }, C) === null);
ok("已租出 / 没写租金 → 不显示", RV.match({ ...x, status: "let" }, C) === null && RV.match({ ...x, rentWeekly: null }, C) === null);
ok("公寓 4 房 DFFH 没有 → 不显示", RV.match({ ...x, beds: 4 }, C) === null);
const h = RV.html(r);
ok("详情写明中位数、样本、数据日期、出处、仅供参考", h.includes("$750") && h.includes("6461 套") && h.includes("截至 2026 年 6 月") && h.includes("DFFH") && h.includes("仅供参考"));
ok("XSS 转义", !RV.html({ ...r, group: "<script>" }).includes("<script>"));
// 发房源页定价参考（goals 第 18 条）
ok("定价参考：没填租金只给中位数", (t => t.includes("$750") && t.includes("DFFH") && t.includes("仅供参考") && !t.includes("你的定价"))(RV.postText({ ...x, rentWeekly: 0 }, C)));
ok("定价参考：高 20% 写清楚", RV.postText({ ...x, rentWeekly: 900 }, C).includes("你的定价高约 20%"));
ok("定价参考：接近中位数", RV.postText({ ...x, rentWeekly: 760 }, C).includes("接近本区中位数"));
ok("定价参考：单间 / 认不出房型 → 空", RV.postText({ ...x, kind: "单间出租" }, C) === "" && RV.postText({ ...x, title: "好房出租", address: "12 Smith St", highlights: [] }, C) === "");
ok("定价参考：英文版", RV.postText({ ...x, rentWeekly: 900 }, C, true).includes("about 20% higher"));
ok("ref 不影响 match（已租出仍不显示）", RV.ref({ ...x, status: "let" }, C) && RV.match({ ...x, status: "let" }, C) === null);
// 生成的数据文件和独立页
const vf = path.join(__dirname, "..", "data/rent_vs.json");
if (fs.existsSync(vf)) {
  const V = JSON.parse(fs.readFileSync(vf, "utf8"));
  ok("rent_vs.json 只有中位数和套数，小于 40KB", fs.statSync(vf).size < 40000 && V.q && V.s.MELBOURNE != null);
  const L = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data/listings.json"), "utf8")).listings || [];
  for (const y of L) {
    const f = path.join(__dirname, "..", "rent", y.id + ".html"); if (!fs.existsSync(f)) continue;
    const page = fs.readFileSync(f, "utf8"), m = y.status === "live" ? RV.match(y, V) : null;
    if (y.status !== "live") ok(`${y.id}：没在租不显示对比`, !page.includes('class="rvs'));
    else ok(`${y.id}：独立页对比和数据一致`, m ? page.includes(RV.short(m)) && page.includes("$" + m.median) : !page.includes('class="rvs'));
  }
}
if (fail) { console.log(`\n${fail} 项失败`); process.exit(1); } else console.log("\n全部通过");
