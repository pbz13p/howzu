const LP = require("../js/listing-page.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) fail++; };
const x = { id: "2110-spencer", status: "live", title: "Spencer St · 两房一卫公寓", address: "2110/138 Spencer St, Melbourne VIC 3000", suburb: "Melbourne CBD", beds: 2, baths: 1, cars: 0, rentWeekly: 650, available: "尽快", photos: ["photos/a.jpg"], desc: "高层两房\n\n第二段" };
const h = LP.render(x, { phone: "0431438595" });
ok("og:title 带租金", /og:title" content="Spencer St · 两房一卫公寓 · \$650\/周/.test(h));
ok("og:image 是完整网址", h.includes('og:image" content="https://howzu.com.au/photos/a.jpg"'));
ok("og:description 含房型和介绍第一句", /og:description" content="Melbourne CBD · 2房1卫 · 尽快入住。高层两房/.test(h));
ok("页面不泄露单元号", !h.includes("2110/138") && h.includes("138 Spencer St"));
ok("有打电话按钮", h.includes('href="tel:0431438595"'));
ok("canonical 指向自己", h.includes('rel="canonical" href="https://howzu.com.au/rent/2110-spencer.html"'));
ok("XSS 转义", !LP.render({ ...x, title: "<script>x</script>" }).includes("<script>x"));
const let_ = LP.render({ ...x, status: "let" }, { phone: "1" });
ok("已租出：noindex、无电话栏", let_.includes("noindex") && !let_.includes("tel:1"));
ok("已租出：不显示“预约看房/押金咨询”关键信息栏", !let_.includes('class="kf"') && LP.render(x, { phone: "1" }).includes('class="kf"'));
ok("已租出：有“留下需求”入口，在租房没有", let_.includes("#leadCard") && !LP.render(x, { phone: "1" }).includes("#leadCard"));
ok("已租出：留需求链接带区域和房型", LP.leadUrl({ id: "a1", suburb: "Melbourne", beds: 1 }).includes("la=CBD") && decodeURIComponent(LP.leadUrl({ id: "a1", suburb: "Carlton", beds: 4 })).includes("lb=3+房+"));
ok("没照片用默认分享图", LP.ogImage({}) === "https://howzu.com.au/icons/og-share.jpg");
ok("描述不超过 110 字", LP.ogDesc({ ...x, desc: "长".repeat(300) }).length <= 110);
const sm = LP.sitemap([x, { ...x, id: "b", status: "let" }]);
ok("信任卡片链到押金指南", LP.trust({id:"a"},3).guide==="/guide/bond.html" && LP.trust({id:"b",user:1},0).guide==="/guide/first-rental.html#scam");
ok("个人房源防骗链接指向真实存在的“防骗 6 招”小节", require("fs").readFileSync(require("path").join(__dirname,"..","guide","first-rental.html"),"utf8").includes('id="scam"') && /防骗/.test(LP.trust({user:1},0).guideText));
ok("sitemap 收录租房指南", sm.includes("guide/bond.html") && sm.includes("guide/apply.html"));
const sm2 = LP.sitemap([x], ["cgt-discount.html", "bond.html", "../evil.html"]);
ok("sitemap 自动收录 guide 目录文章且不重复、不收怪文件名", sm2.includes("guide/cgt-discount.html") && sm2.split("guide/bond.html").length === 2 && !sm2.includes("evil"));
ok("sitemap 只收在租房源", sm.includes("rent/2110-spencer.html") && !sm.includes("rent/b.html") && sm.includes("<loc>https://howzu.com.au/</loc>"));
ok("id 安全检查", LP.safeId("a-1_b") && !LP.safeId("../x") && !LP.safeId(""));
const kf = LP.keyFacts({ status: "live", available: "12 月 1 日", highlights: ["押金 4 周", "租期 12 个月", "近电车", "看房 视频看房"] });
ok("关键信息栏：押金/入住/租期/看房", JSON.stringify(kf.cells) === JSON.stringify([["押金", "4 周"], ["可入住", "12 月 1 日"], ["租期", "12 个月"], ["看房", "视频看房"]]));
ok("关键信息栏：其他亮点保留", JSON.stringify(kf.rest) === '["近电车"]');
ok("关键信息栏：没填写咨询，不编数据", LP.keyFacts({ status: "live" }).cells[0][1] === "咨询" && LP.keyFacts({ status: "let", available: "尽快" }).cells[1][1] === "已租出");

const tO = LP.trust({ id: "a" }, 22), tU = LP.trust({ id: "b", user: true }, 22);
ok("信任信息：自管房源显示成交数和 RTBA", tO.kind === "own" && tO.cases === 22 && /22 套/.test(tO.note) && tO.items.some(i => /RTBA/.test(i[1])));
ok("信任信息：个人发布不冒充直管，给防骗提醒", tU.kind === "user" && !/直管|持牌/.test(tU.title) && tU.items.some(i => /转账/.test(i[0])));
ok("信任信息：没有成交时不写 0 套", LP.trust({}, 0).note === "");
const SP = o => Object.fromEntries(LP.specs(o));
const s1 = SP(x);
ok("房屋信息：固定 13 项、顺序固定", LP.specs(x).map(r => r[0]).join() === "类型,卧室,卫生间,车位,家具,可入住,租期,押金,宠物,包水电网,楼层,看房,设施");
ok("房屋信息：没数据写待确认，不编", s1["押金"] === "待确认" && s1["宠物"] === "待确认" && s1["家具"] === "待确认" && s1["包水电网"] === "待确认");
ok("房屋信息：车位 0 写'无'，房型从标题认出公寓", s1["车位"] === "无" && s1["卧室"] === "2 间" && s1["类型"] === "公寓");
const s2 = SP({ title: "Box Hill 48 层 一房", beds: 0, furnished: false, highlights: ["类型 联排别墅", "押金 4 周", "租期 12 个月", "包水费", "包网", "可养宠物", "看房 视频看房"], desc: "有电梯和健身房，no smoking" });
ok("房屋信息：发房源的选项（类型/押金/租期/看房）直接用", s2["类型"] === "联排别墅" && s2["押金"] === "4 周" && s2["租期"] === "12 个月" && s2["看房"] === "视频看房");
ok("房屋信息：开间、不带家具、包水网、可养宠、楼层、设施", s2["卧室"] === "开间 Studio" && s2["家具"] === "不带家具" && s2["包水电网"] === "包水、网费" && s2["宠物"] === "可以" && s2["楼层"] === "48 层" && s2["设施"] === "电梯、健身房");
ok("房屋信息：发房源选了“不可养宠物”就写不可以", SP({ highlights: ["不可养宠物"] })["宠物"] === "不可以");
ok("房屋信息：发房源点选的楼层优先显示，不再待确认", SP({ highlights: ["楼层 20 层以上"], desc: "位于3层" })["楼层"] === "20 层以上" && SP({})["楼层"] === LP.TBC);
ok("房屋信息：发房源点选的设施进设施栏", SP({ highlights: ["电梯", "空调", "洗碗机", "门禁/礼宾"] })["设施"] === "电梯、空调、洗碗机、门禁/礼宾");
ok("房屋信息：介绍只写“高层”时楼层显示“高层”，不编具体层数", SP({ desc: "高层两房一卫" })["楼层"] === "高层" && SP({ desc: "48 层高层" })["楼层"] === "48 层");
ok("列表卡片：楼层/家具/楼内设施统一几项，待确认的不显示", LP.cardFacts({ title: "West Side Place 48 层两房", desc: "楼内泳池、健身房、阳台", furnished: true }).join() === "48 层,带家具,泳池,健身房" && LP.cardFacts({}).length === 0);
ok("亮点：楼层标签不当绿色亮点显示", LP.keyFacts({ highlights: ["楼层 4–9 层", "近电车"] }).rest.join() === "近电车");
ok("亮点：“不可养宠物”不当亮点显示（房屋信息表里有）", LP.keyFacts({ highlights: ["不可养宠物", "近电车"] }).rest.join() === "近电车");
ok("房屋信息：写了 no pets 就是不可以", SP({ desc: "No pets please" })["宠物"] === "不可以");
ok("关键信息栏：'类型'标签不再当亮点重复显示", !LP.keyFacts({ highlights: ["类型 公寓", "近火车站"] }).rest.includes("类型 公寓"));
const CP = LP.compare([x, { suburb: "Carlton", beds: 1, rentWeekly: null, title: "公寓" }, x, x]);
ok("对比：最多 3 套，第一行租金（面议照写）", CP[0].k === "周租" && CP[0].v.length === 3 && CP[0].v[1] === "面议" && CP[0].v[0] === "$650");
ok("对比：区域 + 13 项房屋信息，不同的行标出来", CP.length === 15 && CP.find(r => r.k === "卧室").diff === true && CP.find(r => r.k === "类型").diff === false);
ok("开放看房：时间标签不当亮点显示，看房栏写'定时开放'", (() => { const k = LP.keyFacts({ status: "live", highlights: ["看房 定好时间", "开放看房 2026-11-15 11:00", "近电车"] }); return k.cells[3][1] === "定时开放" && k.rest.length === 1 && k.rest[0] === "近电车"; })());
console.log(fail ? `listing-page：${fail} 项失败` : "listing-page：全部通过");
// 每篇文章：进了栏目页（文章或租房指南）、带官方来源和免责声明、有分享卡片
{ const fs = require("fs"), path = require("path"), gd = path.join(__dirname, "..", "guide");
  const idx = fs.readFileSync(path.join(gd, "property.html"), "utf8");
  for (const f of fs.readdirSync(gd).filter(f => f.endsWith(".html") && f !== "property.html")) {
    const h = fs.readFileSync(path.join(gd, f), "utf8");
    ok(`文章 ${f}：栏目页有入口、有来源、有免责声明、有 og 卡片`, idx.includes(`/guide/${f}"`) && h.includes("官方来源") && /不构成/.test(h) && h.includes(`og:url" content="https://howzu.com.au/guide/${f}"`));
  } }
// 列表“地图看房”：有开关和地图容器；状态变量要在 render 之前声明（否则首屏渲染报错）
{ const r = require("fs").readFileSync(require("path").join(__dirname, "..", "rentals.html"), "utf8");
  ok("留需求表单：入住时间用点选（不用打字）并随提交带上，区域有常用建议", r.includes('id="lWhen"') && /class="seg" id="lWhen"/.test(r) && r.includes('f.when=w?w.dataset.v:""') && r.includes('list="lAreas"'));
  ok("房屋信息表下有『一键问清待确认项』按钮并接了点击", /function tbcAsk\(/.test(r) && r.includes("${tbcAsk(x)}") && r.includes('data-act="ask-tbc"') && r.includes("[data-tbc]")); }
{ const r = require("fs").readFileSync(require("path").join(__dirname, "..", "rentals.html"), "utf8");
  ok("列表有地图看房开关和地图容器", r.includes('id="mapT"') && r.includes('id="lmap"') && r.includes("function listMap("));
  ok("地图状态变量在 render 之前声明", r.indexOf("let LIVE=") > -1 && r.indexOf("let LIVE=") < r.indexOf("function render("));
  const po = require("fs").readFileSync(require("path").join(__dirname, "..", "post.html"), "utf8");
  ok("发房源页：hidden 的元素真的隐藏（看房时间框不会默认露出来）", po.includes("[hidden]{display:none!important}"));
  ok("地图用免费 OpenStreetMap、不接付费 API", !/maps\.googleapis|api\.mapbox/.test(r)); }
// 学区指南：详情页对口学校下面有入口（跟着对口学校一起出现），查学区页也有入口
{ const fs = require("fs"), path = require("path"), r = fs.readFileSync(path.join(__dirname, "..", "rentals.html"), "utf8"), ix = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ok("详情页对口学校下有“按学区租房指南”入口，并在显示对口学校时一起显示", r.includes('id="cmZG" hidden href="guide/school-zone.html"') && r.includes('getElementById("cmZG")'));
  ok("查学区页链到按学区租房指南", ix.includes('href="guide/school-zone.html"')); }
{ const s = Object.fromEntries(LP.specs({ title: "Carlton 一房", highlights: ["不包水电网"], desc: "" }));
  ok("房屋信息：选了都不包 → 不包，租客自付（不误读成包水电网）", s["包水电网"] === "不包，租客自付");
  ok("关键信息栏：不包水电网不当亮点", !LP.keyFacts({ highlights: ["不包水电网", "近火车站"] }).rest.includes("不包水电网")); }
ok("房屋信息：押金附大约金额", LP.bondWithAmt("4 周", 650) === "4 周（约 $2,600）" && LP.bondWithAmt("1 个月", 650) === "1 个月（约 $2,817）" && LP.bondWithAmt("面议", 650) === "面议" && LP.bondWithAmt("4 周", 0) === "4 周" && LP.specs({ rentWeekly: 500, highlights: ["押金 4 周"] }).find(r => r[0] === "押金")[1] === "4 周（约 $2,000）");
{ const r = require("fs").readFileSync(require("path").join(__dirname, "..", "rentals.html"), "utf8");
  ok("租房页：已租出详情弹窗有『留下需求』按钮，点了预填并记录来源", /isLet\(x\)&&window\.ListingPage&&ListingPage\.leadUrl\?`<button class="letlead" data-letlead/.test(r) && r.includes("fillLead(new URLSearchParams(ListingPage.leadUrl(x)") && r.includes('LEADF?"?lf="+encodeURIComponent(LEADF)') && (r.match(/let LF\b/g) || []).length === 1 && /isLet\(x\)\?\(window\.ListingPage&&ListingPage\.leadUrl\?`<button class="btn pri" data-letlead/.test(r)); }
{ const r = require("fs").readFileSync(require("path").join(__dirname, "..", "rentals.html"), "utf8");
  ok("租房页：成交案例超过 6 套先露 4 套，可展开；『看成交案例』直接展开全部", r.includes("(LETALL||done.length<=6?done:done.slice(0,4))") && r.includes("data-letmore") && r.includes('closeDetail();LETALL=true;')); }
{ const r = require("fs").readFileSync(require("path").join(__dirname, "..", "rentals.html"), "utf8");
  ok("租房页：电脑上详情照片限高、咨询按钮固定在弹窗底部（第一屏能看到标题和按钮）", /@media \(min-width:721px\)\{\.dt-g\{aspect-ratio:auto;height:min\(54vh,540px\)\}/.test(r) && r.includes(".dt-b .acts{position:sticky;bottom:0")); }
{ const LPx = require("../js/listing-page.js"), hl = LPx.render({ id: "zz", status: "let", title: "T", address: "1 A St, Carlton", suburb: "Carlton", beds: 1, photos: [] }, { phone: "0400 000 000" }, 3);
  ok("已租出独立页：底部固定栏有『有空房通知我』（带来源）和『看在租房源』，不放电话", hl.includes('<nav class="bar">') && hl.includes("同楼或附近有空房通知我") && hl.includes("lf=zz") && !hl.includes('href="tel:')); }
{ const A = LP.availText, T = "2026-11-12";
  ok("入住时间：日期已过显示『尽快』", A("2026-11-01", T) === "尽快" && A("2026-11-12", T) === "尽快" && LP.availNow("2026-10-01", T));
  ok("入住时间：未来日期显示『11 月 26 日』，跨年带年份", A("2026-11-26", T) === "11 月 26 日" && A("2027-01-05", T) === "2027 年 1 月 5 日" && !LP.availNow("2026-11-26", T));
  ok("入住时间：文字原样保留、『马上』归一成『尽快』", A("2027 年 1 月", T) === "2027 年 1 月" && A("马上", T) === "尽快" && A("尽快入住", T) === "尽快" && A("", T) === "");
  const pz = require("fs").readFileSync(require("path").join(__dirname, "../post.html"), "utf8");
  ok("发房源：『两周内』提交时存成具体日期，微信号输入框不自动大写", pz.includes('when === "两周内" ? new Date(Date.now() + 14 * 864e5)') && pz.includes('($("#date").value || null)') && pz.includes("d.showPicker") && /id="wechat"[^>]*autocapitalize="off"/.test(pz)); }
{ const ad = require("fs").readFileSync(require("path").join(__dirname, "../admin.html"), "utf8");
  ok("后台：房源和需求的入住时间用中文显示（不再是 2026-11-26）", (ad.match(/ListingPage\.availText\(x\.available\)/g) || []).length === 2 && !ad.includes('esc(x.available ||')); }
{ const A = [{ id: "a", status: "let", suburb: "Carlton", beds: 2 }, { id: "b", status: "live", suburb: "Melbourne", beds: 2 }, { id: "c", status: "live", suburb: "Carlton", beds: 1 }, { id: "d", status: "live", suburb: "Carlton", beds: 2, photos: ["img/x.jpg"], rentWeekly: 650, title: "Carlton · 两房" }, { id: "e", status: "let" }];
  const R = require("../js/listing-page.js").related(A[0], A, 3).map(y => y.id);
  ok("独立页底部推荐：只推在租、不推自己、同区同房型优先", R.join() === "d,c,b");
  const h = require("../js/listing-page.js").render(A[0], {}, 2, require("../js/listing-page.js").related(A[0], A, 3));
  ok("已租出页面显示『这些现在可以租』卡片并链到对应独立页", h.includes("这些现在可以租") && h.includes('href="d.html"') && h.includes("$650/周"));
  ok("没有其它在租房源时不显示推荐区", !require("../js/listing-page.js").render(A[0], {}, 2, []).includes('class="rel"')); }
// 学区租房页：查学区结果里的“学区租房指南”链接都指向真实存在的页面，且页面里有地图和官方来源
{ const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
  const zg = JSON.parse(fs.readFileSync(path.join(root, "data", "zone_guides.json"), "utf8"));
  const bad = Object.values(zg).filter(s => { const f = path.join(root, "guide", s + ".html"); return !fs.existsSync(f) || !fs.readFileSync(f, "utf8").includes('id="zmap"'); });
  ok(`学区租房页 ${Object.keys(zg).length} 个都存在且带地图`, Object.keys(zg).length >= 20 && bad.length === 0);
  ok("查学区结果里接了学区租房页链接", fs.readFileSync(path.join(root, "index.html"), "utf8").includes('data/zone_guides.json') && fs.readFileSync(path.join(root, "index.html"), "utf8").includes('class="zg"')); }
process.exit(fail ? 1 : 0);
