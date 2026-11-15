// 维州规定：出租广告必须写固定租金（RTA 1997 s30F，不写价格或写区间都违法）。
// 所以 data/listings.json 里 status=live 的房源必须有周租；没定价的用 draft，不公开。
const L = require("../data/listings.json").listings;
const bad = L.filter(x => x.status === "live" && !(Number(x.rentWeekly) > 0));
console.log(bad.length ? "✗ 在租房源没写固定周租（维州不允许“面议”广告）：" + bad.map(x => x.id).join(", ") : "✓ 在租房源都写了固定周租");
process.exit(bad.length ? 1 : 0);
