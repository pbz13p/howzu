// 房源筛选/排序测试：node tools/test-filter.js
const F = require("../js/filter.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++; };
const L = [
  { id: "a", status: "live", suburb: "Melbourne CBD", beds: 2, cars: 0, rentWeekly: 800, available: "尽快", highlights: ["带家具"], listedAt: "2026-11-01" },
  { id: "b", status: "live", suburb: "Carlton", beds: 1, cars: 1, rentWeekly: 450, available: "2027 年 1 月", desc: "不带家具，可养宠物", listedAt: "2026-11-10" },
  { id: "c", status: "live", suburb: "Melbourne CBD", beds: 1, cars: null, rentWeekly: null, available: "尽快", desc: "有停车位 no pets" },
  { id: "d", status: "let", suburb: "Carlton", beds: 3, rentWeekly: 300 },
];
const S = (p) => Object.assign(F.empty(), p);
const ids = (l) => l.map(x => x.id).join("");
ok(ids(L.filter(x => F.match(x, S({})))) === "abcd", "不筛选时全部显示");
ok(ids(L.filter(x => F.match(x, S({ when: "now" })))) === "ac", "马上入住");
ok(ids(L.filter(x => F.match(x, S({ when: "later" })))) === "b", "稍后入住不含已租出");
ok(ids(L.filter(x => F.match(x, S({ beds: "2" })))) === "ad", "2 房+");
ok(F.hasFeat(L[0], "furn") && !F.hasFeat(L[1], "furn"), "带家具：认肯定说法，不带家具不算");
ok(!F.hasFeat(L[0], "car") && F.hasFeat(L[1], "car") && F.hasFeat(L[2], "car"), "车位：cars=0 算没有，介绍里写了车位算有");
ok(F.hasFeat(L[1], "pet") && !F.hasFeat(L[2], "pet"), "宠物：no pets 不算");
ok(ids(L.filter(x => F.match(x, S({ area: "Carlton" })))) === "bd", "按区域");
ok(ids(L.filter(x => F.match(x, S({ price: "0-500" })))) === "bd", "$500 以下");
ok(!F.inPrice(L[2], "0-900") && F.inPrice(L[2], ""), "租金面议不进任何价位");
ok(ids(L.filter(x => F.match(x, S({ price: "900-" })))) === "", "$900 以上");
ok(ids(F.sort(L, "low")) === "bacd", "租金低→高：面议在后，已租出最后");
ok(ids(F.sort(L, "high")) === "abcd", "租金高→低");
ok(ids(F.sort(L, "new")) === "bacd", "最新上架");
ok(ids(F.sort([L[3], L[0]], "rec")) === "ad", "推荐：已租出排后");
ok(JSON.stringify(F.areas(L)) === JSON.stringify([["Melbourne CBD", 2], ["Carlton", 1]]), "区域选项按在租数排序（不算已租出）");
ok(F.countWith(L, S({}), { feat: ["car"] }) === 2, "选项后面的数字 = 点了剩几套在租");
ok(F.active(S({})) === false && F.active(S({ feat: ["pet"] })) === true, "是否有筛选");
ok(F.PRICES[0][0] === "" && F.SORTS[0][0] === "rec", "下拉默认项排第一");
ok(ids(L.filter(x => F.match(x, S({ fav: true }), y => y.id === "c")))=== "c", "只看收藏");
if (fail) { console.log(`test-filter: ${fail} 项失败`); process.exit(1); }
console.log("test-filter: 全部通过");
