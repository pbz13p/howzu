// 学区数据自检：文件齐全、数量合理、大部分公立学校的位置落在自己的学区里、排名不重复。
// 运行：node tools/test-data.js
const fs = require("fs");
const path = require("path");
const D = f => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", f), "utf8"));

let fail = 0;
const ok = (name, cond, extra = "") => { if (!cond) { console.log(`✗ ${name} ${extra}`); fail++; } else console.log(`✓ ${name} ${extra}`); };

const schools = D("schools.json");
const zp = D("zones_primary.json").features;
const zs = D("zones_secondary.json").features;
const meta = D("meta.json");

ok("学校数量 > 2000", schools.length > 2000, `(${schools.length})`);
ok("小学学区 > 1000", zp.length > 1000, `(${zp.length})`);
ok("中学学区 > 200", zs.length > 200, `(${zs.length})`);
ok("每所学校都有坐标", schools.every(s => isFinite(s.lat) && isFinite(s.lng) && s.lat < -33 && s.lat > -39.3 && s.lng > 140.9 && s.lng < 150.1));

const ranks = schools.filter(s => s.vce_rank).map(s => s.vce_rank);
ok("VCE 排名不重复", new Set(ranks).size === ranks.length);
ok("VCE 排名从 1 连续", ranks.length > 0 && Math.max(...ranks) === ranks.length, `(${ranks.length} 所)`);
ok("meta 排名数一致", meta.vce_ranked_total === ranks.length);

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inGeom(x, y, g) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h)));
}
const byNo = new Map(schools.map(s => [s.no, s]));
for (const [label, feats] of [["小学", zp], ["中学", zs]]) {
  let n = 0, hit = 0;
  for (const f of feats) {
    const s = byNo.get(f.properties.no);
    if (!s) continue;
    n++;
    if (inGeom(s.lng, s.lat, f.geometry)) hit++;
  }
  const r = n ? hit / n : 0;
  ok(`${label}：学校本身落在自己学区里 ≥ 90%`, r >= 0.9, `(${hit}/${n} = ${(r * 100).toFixed(1)}%)`);
}

try { require("child_process").execFileSync(process.execPath, [require("path").join(__dirname, "test-post-form.js")], { stdio: "inherit" }); } catch (_) { fail++; }
for (const f of ["build-listing-pages.js", "test-listing-page.js", "test-enquire.js", "test-commute.js", "test-fav.js", "test-filter.js", "test-nearby.js", "test-home-rent.js", "test-track.js"]) { try { require("child_process").execFileSync(process.execPath, [require("path").join(__dirname, f)], { stdio: "inherit" }); } catch (_) { fail++; } }
try { require("child_process").execFileSync(process.execPath, [require("path").join(__dirname, "test-work.mjs")], { stdio: "inherit" }); } catch (_) { fail++; }
process.exit(fail ? 1 : 0);
