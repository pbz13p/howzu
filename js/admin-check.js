/* 后台审核：自动找出房源的明显问题（浏览器和 node 测试共用） */
(function (root) {
  const normAddr = a => String(a || "").toLowerCase().replace(/\b(vic|victoria|australia)\b/g, "").replace(/\d{4}\s*$/, "").replace(/[^a-z0-9一-龥]/g, "");
  const ST = { pending: "待审核", live: "已上线", let: "已租出", rejected: "已拒绝" };
  // x：一条房源；others：其他房源 [{id,address,status}]。返回 [{lv:"bad"|"warn", t:文字}]
  function listingIssues(x, others) {
    const out = [], P = x.photos || [], r = +x.rent_weekly || 0;
    if (!P.length) out.push({ lv: "bad", t: "没有照片" }); else if (P.length < 3) out.push({ lv: "warn", t: `只有 ${P.length} 张照片` });
    if (!r) out.push({ lv: "bad", t: "没填租金" }); else if (r < 100 || r > 5000) out.push({ lv: "warn", t: `租金 $${r}/周 看起来不对` });
    if (!x.contact_wechat && !x.contact_phone) out.push({ lv: "bad", t: "没有联系方式" });
    if (String(x.address || "").trim().length < 8) out.push({ lv: "warn", t: "地址太短" });
    else if (!x.lat || !x.lng) out.push({ lv: "warn", t: "地址不是从下拉建议里选的，地图可能定位不到" });
    if (!String(x.description || "").trim()) out.push({ lv: "warn", t: "没写介绍" });
    const k = normAddr(x.address);
    if (k.length >= 8) {
      const d = (others || []).filter(o => o.id !== x.id && normAddr(o.address) === k);
      if (d.length) out.push({ lv: "warn", t: `可能重复：同地址还有 ${d.length} 条（${[...new Set(d.map(o => ST[o.status] || o.status))].join("、")}）` });
    }
    return out;
  }
  const api = { listingIssues, normAddr };
  if (typeof module === "object" && module.exports) module.exports = api; else root.AdminCheck = api;
})(this);
