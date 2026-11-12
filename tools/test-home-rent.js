// 首页“正在招租”卡片测试
const H = require("../js/home-rent.js"), fs = require("fs"), path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error("✗ " + m); } else console.log("✓ " + m); };
const L = [{ id: "a", status: "let" }, { id: "b", status: "live", available: "2027 年 1 月" }, { id: "c", status: "live", available: "尽快", title: "Spencer St · 两房", beds: 2, baths: 1, suburb: "Melbourne CBD", photos: ["p.jpg"] }, { id: "d e", status: "draft" }];
const P = H.pick(L);
ok(P.length === 2 && P[0].id === "c" && P[1].id === "b", "首页招租：只挑在租房源，马上入住排前面");
ok(H.href({ id: "c" }) === "rent/c.html" && H.href({ id: "x y" }) === "rentals.html?id=x%20y", "首页招租：有独立页链独立页，否则链租房页详情");
const c = H.card(P[0]);
ok(/Spencer St<\/b>/.test(c) && /2 房 · 1 卫 · Melbourne</.test(c) && /马上入住/.test(c) && /租金面议/.test(c), "首页招租：卡片显示标题、房型、区、入住；没租金写“租金咨询”不编数");
ok(!/<script/.test(H.card({ id: "z", status: "live", title: "<script>x" })), "首页招租：标题转义");
const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
ok(/id="homeRent"/.test(idx) && /js\/home-rent\.js/.test(idx), "首页有“正在招租”区块");
const J = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "listings.json"), "utf8")).listings;
ok(H.pick(J).every(x => !/^[\w-]+$/.test(x.id) || fs.existsSync(path.join(__dirname, "..", "rent", x.id + ".html"))), "首页招租：卡片链接的独立页都存在");
if (fail) process.exit(1);
