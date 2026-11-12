const O = require("../js/owner-lead.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) fail++; };
ok("房东托管：没留联系方式不能提交", !!O.ownerRow({ area: "Carlton" }).error);
ok("房东托管：没写区域不能提交", !!O.ownerRow({ contact: "wx123" }).error);
const r = O.ownerRow({ area: "Carlton", type: "公寓", beds: "2", now: "空置", where: "海外", contact: "0412 345 678", other: "x".repeat(900) });
ok("房东托管：存成 pending、公众读不到，标明类型", r.status === "pending" && r.kind === "房东托管咨询" && r.beds === 2 && r.contact_phone === "0412 345 678" && !r.contact_wechat);
ok("房东托管：说明文字截断、不写门牌号", r.description.length <= 3000 && r.address === "房东托管咨询：Carlton");
process.exit(fail ? 1 : 0);
