// Cendant 待上线：node tools/test-cendant-draft.js
const fs = require("fs"), C = require("../js/admin-cendant.js"), LP = require("../js/listing-page.js");
let bad = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) bad++; };
const text = fs.readFileSync(__dirname + "/../data/listings.json", "utf8"), D = JSON.parse(text);
const dr = C.drafts(D);
ok("至少有一套 Cendant 草稿（2002 Bouverie，租约 25/12 到期）", dr.some(x => x.id === "2002-bouverie"));
ok("草稿都有周租（s30F）和可入住日期", dr.every(x => x.rentWeekly > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.available)));
ok("草稿不出现在公开房源（status 不是 live）", dr.every(x => x.status === "draft"));
let err = ""; try { C.publish(text, "2002-bouverie", "", "2026-11-20"); } catch (e) { err = e.message; }
ok("没填周租不能上线", /周租/.test(err));
const out = JSON.parse(C.publish(text, "2002-bouverie", "760", "2026-11-20")).listings.find(x => x.id === "2002-bouverie");
ok("上线后变 live、用改过的租金、写核实日期、去掉草稿标记", out.status === "live" && out.rentWeekly === 760 && out.verified === "2026-11-20" && !out.cendantDraft);
err = ""; try { C.publish(C.publish(text, "2002-bouverie", 760, "x"), "2002-bouverie", 760, "x"); } catch (e) { err = e.message; } ok("不能重复上线", /不是草稿/.test(err));
const html = LP.render(Object.assign({}, out, { photos: ["photos/a.jpg"] }), D.contact, 0, []);
ok("房源页有押金 4 周和核实日期", /4 周（约 \$3,040）/.test(html) && /核实日期/.test(html));
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
ok("结构化数据有车位、押金、可入住日期、dateModified", JSON.stringify(ld.amenityFeature).includes("Parking") && JSON.stringify(ld.amenityFeature).includes("Bond") && ld.offers.availabilityStarts === "2026-12-26" && ld.dateModified === "2026-11-20");
const pub = JSON.stringify(D.listings.filter(x => x.status === "live"));
ok("公开房源里没有租客、房东姓名", !/Haowen|Yang Zhang|Yi Liao|Shufen/.test(pub));
process.exit(bad ? 1 : 0);
