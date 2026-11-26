// Supabase 静态页 + IndexNow 测试（假数据，不连网）
const assert = require("assert"), fs = require("fs"), path = require("path");
const S = require("./build-supabase-pages.js"), IN = require("./indexnow.js");
let ok = 0; const t = (n, f) => { f(); ok++; console.log("✓ " + n); };
const row = (o = {}) => Object.assign({ id: "3f2a9c1e-1111-2222-3333-444455556666", kind: "整套出租", status: "live", title: "Carlton 两房 加微信 abc_12345 看房",
  address: "12/34 Lygon St, Carlton VIC 3053", suburb: "Carlton", beds: 2, baths: 1, cars: 0, rent_weekly: 650, available: "2026-12-20", furnished: "带家具",
  photos: ["https://ltnugqlrixophjxoloym.supabase.co/storage/v1/object/public/p/a.jpg", "javascript:alert(1)"], highlights: ["近墨大", "渠道：小红书"],
  description: "两房一卫，近墨大。联系 0412 345 678 或 a.b@gmail.com，wechat: zhang_san88。\n—— English ——\nCall +61 412 345 678", created_at: "2026-11-20T00:00:00Z",
  contact_phone: "0412345678", contact_wechat: "zhang_san88" }, o);
const ctx = { own: [{ id: "2110-spencer", status: "live", title: "Spencer St", suburb: "Melbourne", photos: [] }], today: "2026-11-26", RVC: null };

t("擦掉联系方式：手机号、邮箱、微信号、+61、中国手机号；日期和门牌保留", () => {
  const s = S.scrub("电话 0412 345 678、+61 412 345 678、13812345678，邮箱 a.b@gmail.com，微信：zhang_san88；2026-12-20 入住，34 Lygon St");
  assert.ok(!/0412|412 345|1381234|gmail|zhang_san88/.test(s), s);
  assert.ok(/2026-12-20/.test(s) && /34 Lygon St/.test(s));
});
t("网址：区-街-短id，不带单元号，不和 listings.json 重名", () => {
  assert.strictEqual(S.pageName(row()), "carlton-lygon-st-3f2a9c");
  assert.strictEqual(S.pageName(row({ suburb: "Melbourne CBD", address: "2110/138 Spencer St, Melbourne" })), "melbourne-spencer-st-3f2a9c");
});
const out = S.build([row(), row({ id: "aaaaaaaa-1", kind: "求租需求" }), row({ id: "2110-spencer" })], {}, ctx);
const html = out.files["rent/carlton-lygon-st-3f2a9c.html"];
t("只给真正的出租房源建页（求租需求、和自有房源同 id 的跳过）", () => {
  assert.deepStrictEqual(Object.keys(out.files), ["rent/carlton-lygon-st-3f2a9c.html"]);
  assert.strictEqual(out.liveUrls.length, 1);
});
t("页面没有电话、微信、邮箱、单元号、非 https 图片", () => {
  for (const bad of ["0412", "412 345", "zhang_san88", "abc_12345", "gmail", "12/34", "javascript:", "tel:", "sms:"]) assert.ok(!html.includes(bad), "页面含 " + bad);
});
t("页面有：结构化数据、面包屑、找房订阅卡、联系房东进详情页、个人房源不说“持牌管理”", () => {
  assert.ok(/application\/ld\+json/.test(html) && /BreadcrumbList/.test(html));
  assert.ok(/class="alert-sub"/.test(html));
  assert.ok(html.includes('rentals.html?id=3f2a9c1e-1111-2222-3333-444455556666'));
  assert.ok(html.includes("https://howzu.com.au/rent/carlton-lygon-st-3f2a9c.html"), "canonical 用新网址");
  assert.ok(!/持牌物业管理|持牌管理/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "个人房源不能说持牌");
});
t("下架后：同一个文件变“已租出”、noindex、不显示租金，sitemap 去掉", () => {
  const out2 = S.build([], out.mani, ctx);
  const h2 = out2.files["rent/carlton-lygon-st-3f2a9c.html"];
  assert.ok(h2 && /已租出/.test(h2) && /noindex/.test(h2) && !/\$650/.test(h2));
  assert.strictEqual(out2.liveUrls.length, 0);
  assert.strictEqual(out2.mani["3f2a9c1e-1111-2222-3333-444455556666"].status, "let");
  const sm = S.sitemapWith(S.sitemapWith("<urlset>\n</urlset>\n", out.liveUrls), out2.liveUrls);
  assert.ok(!/carlton-lygon/.test(sm) && (sm.match(/<!--supabase-->/g) || []).length === 1);
});
t("页面名定了就不变（之后改了地址也沿用旧网址）", () => {
  const out3 = S.build([row({ address: "34 Other St, Carlton" })], out.mani, ctx);
  assert.ok(out3.files["rent/carlton-lygon-st-3f2a9c.html"]);
});
t("IndexNow：只推改动的公开页面和 sitemap 新增的网址，不推 data/、js/", () => {
  const u = IN.changedUrls(["rent/carlton-lygon-st-3f2a9c.html", "news/2026-11-26.html", "building/index.html", "data/x.json", "js/a.js", "index.html"],
    "+  <url><loc>https://howzu.com.au/rent/new.html</loc>\n-  <url><loc>https://howzu.com.au/rent/old.html</loc>");
  assert.deepStrictEqual(u.sort(), ["https://howzu.com.au/", "https://howzu.com.au/building/", "https://howzu.com.au/news/2026-11-26.html", "https://howzu.com.au/rent/carlton-lygon-st-3f2a9c.html", "https://howzu.com.au/rent/new.html"].sort());
  assert.ok(/^[0-9a-f]{32}$/.test(IN.KEY));
  assert.strictEqual(fs.readFileSync(path.join(__dirname, "..", IN.KEY + ".txt"), "utf8").trim(), IN.KEY);
});
fs.writeFileSync("/tmp/sb-sample.html", html.replace(/\.\.\//g, "/"));
console.log(`Supabase 静态页测试全部通过（${ok} 项）`);
