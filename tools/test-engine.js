// 投资测算引擎自测：税率表的已知答案 + 整个测算跑得通（四种买家都不出 NaN）。
// 运行：node tools/test-engine.js
// 规则变了（新财年税率、FIRB 费等）：先改 invest-engine.js，再把这里的已知答案改成官方新数字。
const fs = require("fs");
const path = require("path");
const E = require("../invest-engine.js");
const R = E.RULES;

let fail = 0, pass = 0;
function eq(name, got, want, tol = 0.5) {
  if (typeof got !== "number" || !isFinite(got) || Math.abs(got - want) > tol) {
    console.log(`✗ ${name}: 得到 ${got}，应为 ${want}`); fail++;
  } else pass++;
}
function ok(name, cond) { if (!cond) { console.log(`✗ ${name}`); fail++; } else pass++; }

// ---- 印花税 (SRO VIC general rates) ----
eq("印花税 $25k", R.duty(25000), 350);
eq("印花税 $130k", R.duty(130000), 2870);
eq("印花税 $600k", R.duty(600000), 31070);
eq("印花税 $960k", R.duty(960000), 52670);
eq("印花税 $1M", R.duty(1000000), 55000);
eq("印花税 $2.5M", R.duty(2500000), 142500);
ok("FPAD 8%", R.fpadRate === 0.08);

// ---- 土地税 2024–2033 ----
eq("土地税 $49,999", R.landTax(49999), 0);
eq("土地税 $50k", R.landTax(50000), 500);
eq("土地税 $100k", R.landTax(100000), 975);
eq("土地税 $300k", R.landTax(300000), 1350);
eq("土地税 $600k", R.landTax(600000), 2250);
eq("土地税 $1M", R.landTax(1000000), 4650);
eq("土地税 $1.8M", R.landTax(1800000), 11850);
eq("土地税 $3M", R.landTax(3000000), 31650);
ok("缺席业主附加税 4%", R.absenteeRate === 0.04);
ok("空置税 1%", R.vrltRate === 0.01);

// ---- FIRB 2026-27 ----
eq("FIRB $70k", R.firbFee(70000, false), 4600);
eq("FIRB $650k", R.firbFee(650000, false), 15600);
eq("FIRB $1M", R.firbFee(1000000, false), 15600);
eq("FIRB $1.5M", R.firbFee(1500000, false), 31300);
eq("FIRB $3.5M", R.firbFee(3500000, false), 93900);
eq("FIRB 二手 $650k ×3", R.firbFee(650000, true), 46800);

// ---- 个税 2026-27 ----
eq("居民税 $18,200", R.taxResident(18200), 0);
eq("居民税 $45k", R.taxResident(45000), 4020);
eq("居民税 $80k", R.taxResident(80000), 14520);
eq("居民税 $135k", R.taxResident(135000), 31020);
eq("居民税 $190k", R.taxResident(190000), 51370);
eq("非居民税 $135k", R.taxForeign(135000), 40500);
eq("非居民税 $190k", R.taxForeign(190000), 60850);
eq("打工度假税 $45k", R.taxWHM(45000), 6750);
eq("打工度假税 $135k", R.taxWHM(135000), 33750);
eq("LITO $30k", R.lito(30000), 700);
eq("LITO $45k", R.lito(45000), 325);
eq("LITO $70k", R.lito(70000), 0);
// 居民 $80k、有私保：14520 - LITO(0... 80k>66,667 → 0) + Medicare 1600
eq("总税 $80k 居民有私保", E.incomeTax(80000, { taxResident: true, privateCover: true }, 0), 16120);
// Medicare 低收入：$30k → min(600, (30000-28011)*0.1=198.9)
eq("Medicare 低收入 $30k", E.incomeTax(30000, { taxResident: true, privateCover: true }, 0) - Math.max(0, R.taxResident(30000) - R.lito(30000)), 198.9, 0.01);
ok("FRCGW 15%", R.frcgw === 0.15);
ok("Div43 2.5%", R.div43 === 0.025);

// ---- 整个测算：用页面上的默认值，四种买家都要跑通 ----
const html = fs.readFileSync(path.join(__dirname, "..", "invest.html"), "utf8");
const block = html.match(/const DEFAULTS = (\{[\s\S]*?\});/)[1];
const PCT = JSON.parse(html.match(/const PCT = (\[[^\]]*\]);/)[1]);
const D = Function(`return (${block})`)();
function inputs(over) {
  const o = { ...D, ...over };
  for (const k of PCT) o[k] = o[k] / 100;
  o.loanYears = 30; o.io = o.ioYears > 0; o.firbInCostBase = true; o.privateCover = o.privateCover === "yes";
  return o;
}
function finiteDeep(x, p = "r") {
  if (typeof x === "number") return isFinite(x) ? null : p;
  if (x && typeof x === "object") for (const k of Object.keys(x)) {
    if (k === "irr" && x[k] === null) continue;
    const bad = finiteDeep(x[k], p + "." + k); if (bad) return bad;
  }
  return null;
}
for (const buyerType of ["resident", "foreignHere", "whm", "foreignAbroad"]) {
  for (const propType of ["new", "offplanStrata", "established"]) {
    const r = E.run(inputs({ buyerType, propType }));
    const bad = finiteDeep(r);
    ok(`${buyerType}/${propType} 没有 NaN/无穷大${bad ? "（" + bad + "）" : ""}`, !bad);
    ok(`${buyerType}/${propType} 有 ${D.hold} 年`, r.years.length === D.hold);
  }
}
const res = E.run(inputs({ buyerType: "resident", propType: "new" }));
const fa = E.run(inputs({ buyerType: "foreignAbroad", propType: "new" }));
const item = (r, k) => (r.acq.find(a => a.label.includes(k)) || { amt: 0 }).amt;
eq("居民 $650k 新房印花税", item(res, "印花税（"), R.duty(650000));
ok("居民不交 FPAD", item(res, "FPAD") === 0);
eq("海外买家 FPAD = 8% 全价", item(fa, "FPAD"), 650000 * 0.08);
eq("海外买家 FIRB $650k 新房", item(fa, "FIRB"), 15600);
ok("海外买家没有 CGT 折扣", !(fa.sale.discount > 0));
ok("居民有 CGT 折扣（赚钱时）", res.sale.gross <= 0 || res.sale.discount > 0);
ok("海外买家卖房扣 FRCGW", fa.sale.frcgw > 0);
ok("毛租金回报率 = 600×52/650k", Math.abs(res.metrics.grossYield - 600 * 52 / 650000) < 1e-9);

console.log(`\n${pass} 项通过，${fail} 项失败`);
process.exit(fail ? 1 : 0);
