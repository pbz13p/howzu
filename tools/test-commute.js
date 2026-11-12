// 通勤估算测试。由 test-data.js 自动调用。
const C = require("../js/commute.js");
let fail = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fail++; console.log("✗ " + m); } };
const spencer = { lat: -37.8183, lng: 144.9536 }; // 138 Spencer St
const d = C.km(spencer, C.PLACES[0]);
ok(d > 0.8 && d < 1.1, "Spencer St 到 Bourke St Mall 约 1 km（实际 " + d.toFixed(2) + "）");
const r = C.rows(spencer);
ok(r.length === 4 && r[0].mode === "walk" && r[0].text.startsWith("步行约"), "CBD 内按步行");
const mon = r.find(x => x.k === "monash");
ok(mon.mode === "pt" && mon.min >= 50 && mon.min <= 70 && mon.min % 5 === 0, "CBD 到莫纳什 Clayton 公交 50–70 分钟（" + mon.min + "）");
ok(C.km({ lat: -37.8136, lng: 144.9631 }, { lat: -37.9105, lng: 145.134 }) > 18, "CBD–Clayton 直线 18 km 以上");
ok(C.rows({ lat: -33.86, lng: 151.2 }).length === 0, "悉尼坐标不显示");
ok(C.rows(null).length === 0 && C.rows({ lat: NaN, lng: 1 }).length === 0, "无坐标不显示");
ok(C.fmtKm(0.94) === "0.9 km" && C.fmtKm(18.6) === "19 km", "距离格式");
ok(C.est(0.1).min >= 1 && C.est(2).min === 15, "最短时间");
const sq = (no, name, x0, y0, d, yl) => ({ properties: { no, name, yl }, geometry: { type: "Polygon", coordinates: [[[x0, y0], [x0 + d, y0], [x0 + d, y0 + d], [x0, y0 + d], [x0, y0]]] } });
const fc = { features: [sq(1, "A High", 144, -38, 1, "8"), sq(1, "A High", 144, -38, 1, "7"), sq(2, "B High", 144.5, -37.6, 1, "7"), sq(3, "Far", 150, -30, 1, "7")] };
const z = C.zonesAt(fc, { lat: -37.5, lng: 144.7 });
ok(z.length === 2 && z.map(x => x.name).join() === "A High,B High", "对口学校去重、只要包含该点的");
ok(C.zonesAt(fc, { lat: -29.5, lng: 150.5 })[0].name === "Far" && C.zonesAt(null, {}).length === 0, "对口学校边界情况");
const hole = { properties: { name: "H" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] } };
ok(C.inFeature(hole, 1, 1) && !C.inFeature(hole, 5, 5), "多边形里的洞不算");
const real = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../data/zones_secondary.json"), "utf8"));
ok(C.zonesAt(real, spencer).length >= 1, "Spencer St 能找到对口公立中学（真实学区数据）");
{ const r = C.rows(spencer, [C.EXTRA.find(p => p.k === "deakin")]);
  ok(r.length === C.PLACES.length + 1 && r[r.length - 1].extra === true && r[0].extra === false, "可以加上自选学校，排在固定地点后面并标为自选"); }
ok(C.EXTRA.length >= 8 && C.EXTRA.every(p => p.lat < -37.3 && p.lat > -38.6 && p.lng > 144.3 && p.lng < 145.8), "可选学校坐标都在墨尔本范围内");
console.log(`通勤估算：${n - fail}/${n} 通过`);
process.exit(fail ? 1 : 0);
