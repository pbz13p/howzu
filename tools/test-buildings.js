// 楼盘百科测试：楼址匹配、30 个页面内容完整、结构化数据能解析、没有私有字段、楼盘订阅只匹配这栋楼的房源。
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const BM = require("../js/building-match.js");
let ok = 0; const t = (name, fn) => { fn(); ok++; console.log("✓ " + name); };

t("楼址解析：号段、去楼名前缀、A'Beckett 撇号、单个门牌", () => {
  assert.deepStrictEqual(BM.parseBuilding("68-82 Southbank Boulevard SOUTHBANK VIC 3006"), { from: 68, to: 82, street: "southbank boulevard" });
  assert.deepStrictEqual(BM.parseBuilding("Eureka Tower 3-7 Riverside Quay SOUTHBANK VIC 3006"), { from: 3, to: 7, street: "riverside quay" });
  assert.strictEqual(BM.parseBuilding("143-171 A'Beckett Street MELBOURNE VIC 3000").street, "abeckett street");
  assert.deepStrictEqual(BM.parseBuilding("220 Spencer Street MELBOURNE VIC 3000"), { from: 220, to: 220, street: "spencer street" });
});
t("房源地址在楼里：同街 + 号段内；缩写 St/Blvd 也认", () => {
  const b = BM.parseBuilding("9-23 MacKenzie Street MELBOURNE VIC 3000");
  assert.ok(BM.inBuilding("1913/23 Mackenzie St, Melbourne VIC 3000", b));
  assert.ok(!BM.inBuilding("1/25 Mackenzie St, Melbourne VIC 3000", b));
  assert.ok(!BM.inBuilding("23 Therry St, Melbourne VIC 3000", b));
  assert.ok(BM.inBuilding("5001/70 Southbank Blvd, Southbank VIC 3006", BM.parseBuilding("68-82 Southbank Boulevard SOUTHBANK VIC 3006")));
  assert.deepStrictEqual(BM.fromKey(BM.key(b)), b);
});

const { PICK } = require("./build-buildings.js");
t("第一批正好 30 栋，没有学生公寓、没有 Tower N 这类名字，楼名不重复", () => {
  assert.strictEqual(PICK.length, 30);
  assert.ok(PICK.every(b => b.use === "Residential Apartment" && !/^Tower\s*\d/i.test(b.name)));
  assert.strictEqual(new Set(PICK.map(b => b.slug)).size, 30);
});
t("每页：第一段直接给答案、DFFH 租金带日期、周边直线距离、订阅卡带楼名、两段结构化数据能解析", () => {
  for (const b of PICK) {
    const h = fs.readFileSync(path.join(root, "building", b.slug + ".html"), "utf8");
    assert.ok(/<p class="ans">[^<]*共 \d+ 层、\d+ 套住宅公寓/.test(h) || /<p class="ans">[^<]*共 — 层/.test(h), b.name + " 答案段");
    assert.ok(/DFFH/.test(h) && /截至 20\d\d 年/.test(h), b.name + " 租金来源和日期");
    assert.ok(/直线距离估算/.test(h), b.name);
    assert.ok(h.includes(`data-building="${b.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`) || /class="dot lst"/.test(h), b.name + " 订阅卡或房源");
    const lds = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    assert.deepStrictEqual(lds.map(x => x["@type"]), ["ApartmentComplex", "BreadcrumbList"]);
    assert.ok(!/undefined|NaN|null 层/.test(h), b.name + " 没有坏值");
    assert.ok(!/owner|tenant|房东姓名|租客姓名|leaseStart|rentHistory/i.test(h), b.name + " 没有私有字段");
  }
});
t("目录页、sitemap、llms.txt、首页、CBD 和 Southbank 区域页都有入口", () => {
  const idx = fs.readFileSync(path.join(root, "building/index.html"), "utf8");
  assert.strictEqual((idx.match(/<tr data-q=/g) || []).length, 30);
  const sm = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.strictEqual((sm.match(/\/building\/[a-z0-9-]+\.html/g) || []).length, 30);
  assert.ok(/building\/australia-108\.html/.test(fs.readFileSync(path.join(root, "llms.txt"), "utf8")));
  assert.ok(fs.readFileSync(path.join(root, "index.html"), "utf8").includes('href="building/"'));
  for (const f of ["guide/area-melbourne-cbd.html", "guide/area-southbank.html"]) assert.ok(fs.readFileSync(path.join(root, f), "utf8").includes("/building/"), f);
});
t("楼盘订阅：只匹配这栋楼里的房源", () => {
  const A = require("../js/alert-sub.js"), Al = require("./alerts.js");
  const b = BM.parseBuilding("9-23 MacKenzie Street MELBOURNE VIC 3000");
  const s = A.row({ email: "a@b.com", consent: 1, suburb: "Melbourne", building: "Conservatory", bld: BM.key(b) }, "p", "", "2026-11-24");
  assert.ok(Al.matches(s, { suburb: "Melbourne", beds: 2, rentWeekly: 700, address: "1913/23 Mackenzie St, Melbourne VIC 3000" }));
  assert.ok(!Al.matches(s, { suburb: "Melbourne", beds: 2, rentWeekly: 700, address: "3005/327 La Trobe St, Melbourne VIC 3000" }));
});
console.log(`楼盘百科测试全部通过（${ok} 项）`);
