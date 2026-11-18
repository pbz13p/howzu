// 代看房预约：node tools/test-inspect.js
const I = require("../js/inspect-book.js");
let bad = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) bad++; };
ok("没填房源要提示", I.check({ house: "", contact: "wx12345" }) !== "");
ok("没留联系方式要提示", I.check({ house: "https://howzu.com.au/rent/2110-spencer.html", contact: "" }) !== "");
const r = I.row({ house: "https://howzu.com.au/rent/2110-spencer.html", when: "12 月第一周", contact: "wx_abc123", live: true }, "https://howzu.com.au/guide/study-abroad.html", "xhs");
ok("存成待审核（公众看不到）", r.status === "pending" && r.kind === "代看房");
ok("渠道和直播要求写进描述", /渠道：xhs/.test(r.description) && /视频直播看房：要/.test(r.description) && r.highlights.includes("要视频直播"));
ok("微信号进 contact_wechat", r.contact_wechat === "wx_abc123" && r.contact_phone === null);
const p = I.row({ house: "1 Spencer St Melbourne", contact: "+86 138 0000 0000" }, "x", "");
ok("电话进 contact_phone", p.contact_phone === "+86 138 0000 0000" && !/渠道/.test(p.description));
ok("字段长度不超数据库限制", r.title.length <= 80 && r.address.length <= 200 && r.address.length >= 5);
process.exit(bad ? 1 : 0);
