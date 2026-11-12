// 发房源表单纯函数测试（由 test-data.js 调用）
const F = require("../js/post-form.js");
let fail = 0; const ok = (n, c) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const T = ["整套出租", "单间出租", "短租"];
ok("草稿：无保存 → 用默认", eq(F.chipState(T, null, true, [true, false, false]), [true, false, false]));
ok("草稿：单选恢复", eq(F.chipState(T, ["短租"], true, [true, false, false]), [false, false, true]));
ok("草稿：单选保存值失效 → 用默认", eq(F.chipState(T, ["旧选项"], true, [true, false, false]), [true, false, false]));
ok("草稿：多选恢复（含全不选）", eq(F.chipState(T, ["整套出租", "短租"], false, [false, false, false]), [true, false, true]) && eq(F.chipState(T, [], false, [false, false, false]), [false, false, false]));
ok("租期：放到亮点最前", eq(F.withLease(["包网"], "12 个月"), ["租期 12 个月", "包网"]));
ok("租期：不重复、可清空", eq(F.withLease(["租期 6 个月", "包网"], "12 个月"), ["租期 12 个月", "包网"]) && eq(F.withLease(["租期 6 个月"], ""), []));
ok("今天日期格式", F.todayISO(new Date(2026, 0, 5)) === "2026-01-05");
ok("日期显示", F.niceDate("2026-12-01") === "12 月 1 日" && F.niceDate("马上") === "马上");
ok("押金/看房：结构化标签不重复", eq(F.withTag(F.withTag(["包网"], "押金 ", "4 周"), "看房 ", "视频看房"), ["看房 视频看房", "押金 4 周", "包网"]) && eq(F.withTag(["押金 4 周"], "押金 ", "面议"), ["押金 面议"]));
ok("照片换顺序", eq(F.move([1, 2, 3, 4], 3, 0), [4, 1, 2, 3]) && eq(F.move([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]) && eq(F.move([1, 2], 0, 5), [1, 2]));
ok("押金金额", F.bondText(650, "4 周") === "押金 ≈ $2,600" && F.bondText(0, "4 周") === "" && F.bondText(650, "面议") === "");
const pv = F.previewLines({ kind: "整套出租", beds: 2, baths: 1, cars: 1, suburb: "Carlton", rent_weekly: 650, title: "Carlton 两房", available: "2026-12-01", furnished: "带家具", highlights: ["a", "b", "c", "d", "e"] });
ok("预览：价格/房型/入住", pv.price === "$650" && pv.facts === "2 房 · 1 卫 · 1 车位 · Carlton" && pv.meta === "12 月 1 日入住 · 带家具" && pv.tags.length === 4);
ok("预览：单间 + 马上 + 没租金", (q => q.facts === "单间" && q.meta === "马上入住" && q.price === "租金面议")(F.previewLines({ kind: "单间出租", beds: 1, baths: 1, available: "马上" })));
ok("预览：押金/租期/类型等标签不当亮点小标签显示（和上线后一致）", F.previewLines({ beds: 1, baths: 1, highlights: ["类型 公寓", "押金 4 周", "近电车"] }).tags.join() === "近电车");
ok("预览：没选日期不显示", F.previewLines({ beds: 1, baths: 1, available: "选日期" }).meta === "");
// ---- 后台审核自动检查 ----
const A = require("../js/admin-check.js");
const good = { id: 1, photos: [1, 2, 3], rent_weekly: 650, contact_phone: "0400", address: "5/138 Spencer St, Melbourne VIC 3000", lat: 1, lng: 2, description: "好房" };
ok("审核：信息齐全 → 无提示", A.listingIssues(good, []).length === 0);
const bad = A.listingIssues({ id: 2, photos: [], rent_weekly: 0, address: "x" }, []).map(i => i.t).join("|");
ok("审核：缺照片/租金/联系方式", /没有照片/.test(bad) && /没填租金/.test(bad) && /没有联系方式/.test(bad));
ok("审核：租金异常", A.listingIssues({ ...good, rent_weekly: 65000 }, []).some(i => /看起来不对/.test(i.t)));
ok("审核：同地址（大小写/逗号/邮编不同）算重复", A.listingIssues(good, [{ id: 9, address: "5/138 spencer st melbourne", status: "live" }]).some(i => /可能重复.*已上线/.test(i.t)));
ok("审核：自己不算重复", !A.listingIssues(good, [{ id: 1, address: good.address, status: "pending" }]).some(i => /重复/.test(i.t)));
const sx = { id: "ab1", suburb: "Carlton", kind: "整套出租", beds: 2, baths: 1, cars: 1, rent_weekly: 650, available: "2026-12-01", furnished: "带家具", highlights: ["租期 12 个月", "近大学", "微信看房"] };
const wx = A.shareText(sx, "wx"), xhs = A.shareText(sx, "xhs");
ok("文案：微信带详情链接", /【Carlton · 2 房 1 卫 1 车位】\$650\/周/.test(wx) && /12 月 1 日入住/.test(wx) && wx.includes("rentals.html?id=ab1"));
ok("文案：小红书无链接、无微信字样、带话题", !/http|微信|rentals/.test(xhs) && xhs.includes("#Carlton租房") && xhs.includes("私信"));
const on = A.ownerNotice({ id: "ab 1", contact_name: "王先生", title: "Carlton 两房" });
ok("通知房东：带称呼、标题、链接", on.startsWith("王先生，您好") && on.includes("「Carlton 两房」") && on.includes("rentals.html?id=ab%201"));
ok("通知房东：没名字也通顺", A.ownerNotice({ id: 3, title: "" }).startsWith("您好！") && A.ownerNotice({ id: 3 }).includes("「您的房源」"));
// ---- 租客留需求 ----
const Ld = require("../js/lead.js");
const lr = Ld.leadRow({ area: "Carlton", budget: "$600", beds: "2 房", when: "2 月初", contact: "wx_abc123", ref: "rentals.html" });
ok("留需求：存成待审核的求租需求（公众看不到）", lr.status === "pending" && lr.kind === "求租需求" && Ld.isLead(lr) && lr.photos.length === 0);
ok("留需求：字段符合 listings 表限制", lr.title.length >= 4 && lr.title.length <= 80 && lr.address.length >= 5 && lr.rent_weekly === 600 && lr.beds === 2 && lr.contact_wechat === "wx_abc123" && lr.contact_phone === null);
ok("留需求：手机号存进电话栏、单间=0 房", (r => r.contact_phone === "0412 345 678" && r.contact_wechat === null && r.beds === 0)(Ld.leadRow({ contact: "0412 345 678", beds: "单间" })));
ok("留需求：没留联系方式 → 提示", !!Ld.leadRow({ area: "CBD", contact: " " }).error);
ok("留需求：预算乱填不报错、区域可空", (r => r.rent_weekly === null && r.address.length >= 5 && /区域不限/.test(r.title))(Ld.leadRow({ budget: "5", contact: "a@b.co" })));
// 开放看房时间
const ws = F.withSlots(["近火车站", "开放看房 2026-01-01 10:00"], ["2026-11-16T10:00", "", "bad", "2026-11-15T11:00", "2026-11-16T10:00"]);
ok("开放看房：排序、去重、去坏值、替换旧的", JSON.stringify(ws) === JSON.stringify(["开放看房 2026-11-15 11:00", "开放看房 2026-11-16 10:00", "近火车站"]));
ok("开放看房：最多 3 个", F.withSlots([], ["2026-11-15T09:00", "2026-11-15T10:00", "2026-11-15T11:00", "2026-11-15T12:00"]).length === 3);
{ const st = F.splitTags(["类型 公寓", "押金 4 周", "租期 12 个月", "看房 视频看房", "开放看房 2026-11-15 11:00", "不可养宠物", "近火车站", "包网"]);
  ok("自动写标题：结构化标签不当亮点，真亮点保持顺序", st.real.join() === "近火车站,包网" && st.info.length === 6); }
{ const h = F.withTag(F.withTag(["近火车站"], "楼层 ", "10–19 层"), "楼层 ", "20 层以上");
  ok("楼层：点选存成一个结构化标签，改选会替换", h.join() === "楼层 20 层以上,近火车站" && F.splitTags(h).real.join() === "近火车站"); }
ok("设施：旧草稿里的“有电梯/泳池/健身房”自动转成新设施选项", F.oldAmen({ highlights: ["有电梯", "泳池/健身房", "近大学"] }).join() === "电梯,泳池,健身房" && F.oldAmen({ amen: ["空调"] }).join() === "空调" && F.oldAmen(null).length === 0);
{ const AC = require("../js/admin-check.js"), LPx = require("../js/listing-page.js");
  const row = { id: "a1", title: "Carlton 两房", contact_name: "王先生", beds: 2, baths: 1, cars: 0, furnished: "带家具", available: "马上入住", status: "pending", highlights: ["租期 12 个月", "押金 4 周", "不可养宠物", "楼层 4–9 层", "包网", "电梯"], description: "" };
  const m = AC.missingSpecs(row, LPx);
  ok("后台：房屋信息待确认项用详情页同一套规则算", m.join() === "类型" && AC.missingSpecs({ ...row, highlights: [] }, LPx).includes("租期"));
  const t = AC.askOwner(row, ["家具", "租期"]);
  ok("后台：一键复制问房东的话，带称呼、房源名和缺的项", /^王先生，您好/.test(t) && t.includes("「Carlton 两房」") && t.includes("家具、租期") && AC.askOwner(row, []) === ""); }
console.log("发房源表单测试全部通过");
// 租金包含：单独一组选项；“都不包”存成结构化标签，不当亮点；旧草稿迁移
ok("租金包含：都不包存成“不包水电网”", eq(F.billTags(["都不包"]), ["不包水电网"]) && eq(F.billTags(["包水费", "包网"]), ["包水费", "包网"]));
ok("租金包含：旧草稿亮点里的包水/电/网搬过来", eq(F.oldBills({ highlights: ["近火车站", "包水费", "包网"] }), ["包水费", "包网"]) && eq(F.oldBills({ bills: ["都不包"], highlights: ["包网"] }), ["都不包"]));
ok("租金包含：“不包水电网”不当亮点", F.splitTags(["不包水电网", "近火车站"]).real.join() === "近火车站");
// 后台租客需求：自动配在租房源 + 通知话术
{ const AC = require("../js/admin-check.js");
  const L = [{ id: "a", status: "live", suburb: "Melbourne CBD", beds: 2, rentWeekly: null, title: "Spencer St 两房" },
    { id: "b", status: "let", suburb: "Melbourne CBD", beds: 2, title: "已租出" },
    { id: "c", status: "live", suburb: "Carlton", beds: 1, rent_weekly: 500, title: "Carlton 一房" },
    { id: "d", status: "live", suburb: "Carlton", beds: 2, rent_weekly: 900, title: "Carlton 两房贵" },
    { id: "e", status: "live", kind: "求租需求", suburb: "Carlton", title: "求租" }];
  const ids = l => AC.leadMatches(l, L).map(x => x.id).join();
  ok("配房：CBD 两房 → 只配在租的 CBD 两房（租金面议的保留）", ids({ suburb: "CBD", beds: 2, rent_weekly: 700 }) === "a");
  ok("配房：区域带括号说明也能配、预算超 10% 的不配", ids({ suburb: "Carlton（墨大附近）", rent_weekly: 600 }) === "c");
  ok("配房：区域不限、单间不限房型", ids({ suburb: "墨尔本（区域不限）", beds: 0 }) === "a,c,d");
  const t = AC.leadNotice({ title: "求租 · CBD · 2 房" }, AC.leadMatches({ suburb: "CBD", beds: 2 }, L));
  ok("配房：通知话术带需求和房源链接", t.includes("（CBD · 2 房）") && t.includes("https://howzu.com.au/rentals.html?id=a") && !t.includes("undefined")); }
if (fail) { console.log(`发房源表单测试失败 ${fail} 项`); process.exit(1); }
