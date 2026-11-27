// 中介 REAXML 导入测试：官方样例 + 3 份仿真数据（导入、改租金、下架），模拟数据库，不连网
const assert = require("assert"), fs = require("fs"), path = require("path");
const F = require("./import-feed.js"), FW = require("./forward-leads.js"), S = require("./build-supabase-pages.js");
const fx = n => fs.readFileSync(path.join(__dirname, "fixtures/reaxml", n), "utf8");
let ok = 0; const t = (n, f) => { f(); ok++; console.log("✓ " + n); };
const AG = { key: "simag", name: "仿真中介", agentID: "SIMAG1", minStandardsConfirmed: true, snapshot: true, phone: "03 9000 0000" };

// 一个假的 listings 表：把 plan 的结果真的应用上去
const DB = []; let seq = 0;
function apply(p) {
  for (const row of p.insert) DB.push(Object.assign({ id: "00000000-0000-4000-8000-" + String(++seq).padStart(12, "0"), created_at: "2026-11-27T00:00:00Z" }, row));
  for (const [id, row] of p.update) Object.assign(DB.find(r => r.id === id), row);
  for (const id of p.let) DB.find(r => r.id === id).status = "let";
}
const run = file => { const p = F.plan(F.parseFeed(fx(file)), DB.filter(r => /^feed:simag:/.test(r.review_note)), AG); apply(p); return p; };
const byU = u => DB.find(r => r.review_note.startsWith(`feed:simag:${u} `));

t("官方样例：解析出出租一条（Richmond 4 房 $350/周）和撤回一条；撤回的不导", () => {
  const items = F.parseFeed(fx("official-sample.xml"));
  assert.strictEqual(items.length, 2);
  const r = F.toRow(items[0], { key: "rea", name: "样例中介", minStandardsConfirmed: true }).row;
  assert.strictEqual(r.rent_weekly, 350); assert.strictEqual(r.beds, 4); assert.strictEqual(r.suburb, "Richmond");
  assert.strictEqual(r.available, "2009-01-26"); assert.strictEqual(r.cars, 6); assert.ok(r.photos.every(u => u.startsWith("https://")));
  assert.ok(F.toRow(items[1], { key: "rea", name: "x" }).skip);
});
t("仿真 1 导入：2 套进库（月租换成周租），没固定租金、外州、出售的都不导", () => {
  const p = run("sim-1-initial.xml");
  assert.strictEqual(p.insert.length, 2);
  assert.deepStrictEqual(p.skip.map(s => s[0]).sort(), ["SIM-003", "SIM-004"]);
  const a = byU("SIM-001"), b = byU("SIM-002");
  assert.strictEqual(a.rent_weekly, 620); assert.strictEqual(a.status, "live"); assert.strictEqual(a.contact_name, "仿真中介"); assert.strictEqual(a.contact_phone, "03 9000 0001");
  assert.ok(a.highlights.includes("中介：仿真中介") && a.highlights.includes("中介已确认符合最低租住标准"));
  assert.ok(!/1203/.test(a.address), "不写单元号");
  assert.strictEqual(b.rent_weekly, 600, "$2600/月 → $600/周");
  assert.ok(!DB.some(r => /SALE-1/.test(r.review_note)), "出售房源不导");
});
t("同一份 feed 再跑一次：什么都不变（不重复插入）", () => {
  const p = run("sim-1-initial.xml"); assert.strictEqual(p.insert.length + p.update.length + p.let.length, 0);
});
t("仿真 2 改租金：SIM-001 更新成 $650，不新增", () => {
  const p = run("sim-2-rent-change.xml");
  assert.strictEqual(p.insert.length, 0); assert.strictEqual(p.update.length, 1);
  assert.strictEqual(byU("SIM-001").rent_weekly, 650);
});
t("仿真 3 下架：SIM-001 leased → 已租出；SIM-002 不在全量 feed 里 → 已租出；新的 SIM-005 进库", () => {
  const p = run("sim-3-delist.xml");
  assert.strictEqual(byU("SIM-001").status, "let"); assert.strictEqual(byU("SIM-002").status, "let"); assert.strictEqual(byU("SIM-005").status, "live");
  assert.strictEqual(p.insert.length, 1);
});
t("FTP 增量（snapshot:false）：不在这次文件里的不下架", () => {
  const p = F.plan(F.parseFeed(fx("sim-3-delist.xml")), [{ id: "x", status: "live", rent_weekly: 500, review_note: "feed:simag:OTHER · mod 1" }], Object.assign({}, AG, { snapshot: false }));
  assert.ok(!p.let.includes("x"));
});
t("中介没书面确认最低租住标准：只进后台（pending），不公开", () => {
  const r = F.toRow(F.parseFeed(fx("sim-1-initial.xml"))[0], Object.assign({}, AG, { minStandardsConfirmed: false })).row;
  assert.strictEqual(r.status, "pending"); assert.ok(!r.highlights.includes("中介已确认符合最低租住标准"));
});
t("固定周租的判断：文字、区间、display=no 都不算", () => {
  const w = (amount, period = "week", display = "yes") => F.weeklyRent({ rent: { amount, period, display } });
  assert.strictEqual(w("450"), 450); assert.strictEqual(w("$1,950", "month"), 450); assert.strictEqual(w("Contact agent"), null);
  assert.strictEqual(w("450-480"), null); assert.strictEqual(w("450", "week", "no"), null);
});
t("静态页：显示“由 仿真中介 提供”和中介电话，没有租客或经纪人的私人邮箱", () => {
  const rows = DB.filter(r => r.status === "live").map(r => Object.assign({}, r));
  const out = S.build(rows, {}, { own: [], today: "2026-11-27" });
  const f = Object.keys(out.files).find(k => /clayton/.test(k)); assert.ok(f, "SIM-005 有页面");
  const h = out.files[f];
  assert.ok(/由 仿真中介 提供/.test(h) && /tel:0390000000/.test(h));
  assert.ok(!/amy@example\.com|0400 000 001/.test(h));
  fs.writeFileSync("/tmp/feed-sample.html", h.replace(/\.\.\//g, "/"));
});
t("询盘转发：按描述里的房源 id 找到对应中介房源", () => {
  const x = byU("SIM-005");
  const m = FW.matchLeads([{ id: "l1", kind: "求租需求", description: "联系：0412…\n来自：rentals.html?id=" + x.id }, { id: "l2", kind: "求租需求", description: "来自：rentals.html" }], [x]);
  assert.strictEqual(m.length, 1); assert.ok(/#3 forwarded/.test(FW.emailHtml({ name: "仿真中介" }, m[0][0], x, 3)));
});
console.log(`中介导入测试全部通过（${ok} 项）`);
