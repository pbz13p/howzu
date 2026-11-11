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
  // 一键生成转发文案。kind："wx" 微信（带链接）/ "xhs" 小红书（不放链接、不写微信/电话等容易被限流的词）
  const XHS_BAD = /微信|vx|v信|加v|电话|手机|二维码|链接|http|www\.|\.com/gi;
  function shareText(x, kind) {
    const area = x.suburb || "墨尔本", room = x.kind === "单间出租" ? "单间" : `${x.beds} 房 ${x.baths} 卫${x.cars ? " " + x.cars + " 车位" : ""}`;
    const av = /^\d{4}-\d\d-\d\d$/.test(x.available || "") ? `${+x.available.slice(5, 7)} 月 ${+x.available.slice(8, 10)} 日` : (x.available || "");
    const when = av ? (av === "马上" ? "马上入住" : av + "入住") : "";
    const hl = (x.highlights || []).slice(0, 8), rent = +x.rent_weekly ? `$${x.rent_weekly}/周` : "租金面议";
    const L = [`【${area} · ${room}】${rent}`, when && "📅 " + when, x.furnished && "🛋 " + x.furnished, hl.length && "✨ " + hl.join(" · ")];
    if (kind === "xhs") {
      const body = L.filter(Boolean).join("\n");
      return [body, "照片都是实拍，感兴趣的私信我～", `#墨尔本租房 #${area.replace(/\s+/g, "")}租房 #墨尔本找房 #澳洲留学`].join("\n\n").replace(XHS_BAD, "");
    }
    return [L.filter(Boolean).join("\n"), `📍 ${area}`, "", `👉 照片和详情：https://howzu.com.au/rentals.html?id=${encodeURIComponent(x.id)}`].join("\n");
  }
  // 审核通过后发给房东的通知（带房源链接）
  function ownerNotice(x) {
    const name = String(x.contact_name || "").trim(), t = String(x.title || "").trim() || x.address || "您的房源";
    return [`${name ? name + "，" : ""}您好！您在好租 Howzu 发布的房源「${t}」已审核通过，现在已经上线：`,
      `https://howzu.com.au/rentals.html?id=${encodeURIComponent(x.id)}`, "",
      "把这个链接转发到微信群/朋友圈，租客能直接看到照片和租金。有租客会直接联系您；租出去后请回复我们一声，我们帮您标记“已租出”。", "—— 好租 Howzu"].join("\n");
  }
  const api = { listingIssues, normAddr, shareText, ownerNotice };
  if (typeof module === "object" && module.exports) module.exports = api; else root.AdminCheck = api;
})(this);
