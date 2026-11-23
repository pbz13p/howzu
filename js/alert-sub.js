// 找房订阅：“有新房通知我”小卡片。存进现有 listings 表：kind="找房订阅"、status="pending"（公众读不到），
// 区=suburb、几房=beds、预算上限=rent_weekly、语言/房型=highlights、邮箱和同意时间写在 description。
// 页面放 <div class="alert-sub" data-suburb="Carlton" data-max="700" data-beds="1"></div> 即可；区和预算已按页面填好，用户只填邮箱 + 勾同意。
(function () {
  const KIND = "找房订阅";
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
  function check(v) {
    if (!EMAIL.test(String(v.email || "").trim())) return "请填正确的邮箱";
    if (!v.consent) return "请勾选同意接收房源邮件";
    const m = Number(v.max); if (v.max !== "" && v.max != null && !(m >= 50 && m <= 20000)) return "预算请填 50–20000 之间的周租";
    return "";
  }
  function row(v, page, src, now) {
    const sub = String(v.suburb || "").trim().slice(0, 60), beds = v.beds === "" || v.beds == null ? null : Math.max(0, Math.min(10, parseInt(v.beds, 10) || 0));
    const max = v.max === "" || v.max == null ? null : Math.round(Number(v.max));
    const bld = String(v.building || "").trim().slice(0, 60), bk = String(v.bld || "").trim().slice(0, 240);
    const where = bld ? bld + (sub ? "（" + sub + "）" : "") : (sub || "全墨尔本");
    return { status: "pending", kind: KIND, title: ("找房订阅 · " + where).slice(0, 80), address: ("订阅：" + where).slice(0, 200), suburb: sub || null,
      beds, rent_weekly: max, photos: [], highlights: ["找房订阅", "lang:" + (v.lang === "en" ? "en" : "zh"), "type:" + (v.type || "any")].concat(bld && bk ? ["楼:" + bk] : []),
      description: ["email:" + String(v.email).trim().toLowerCase(), "consent:" + now + "（本人在网页上勾选同意接收房源邮件）", "page:" + page, src ? "渠道：" + src : ""].filter(Boolean).join("\n").slice(0, 3000) };
  }
  if (typeof module !== "undefined") { module.exports = { row, check, KIND, EMAIL }; return; }
  const T = s => (window.HowzuLang ? HowzuLang.t(s) : s), en = () => (document.documentElement.lang || "").startsWith("en");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const css = document.createElement("style");
  css.textContent = `.alert-sub .as{background:#f2f8f5;border:1px solid #cfe3da;border-radius:12px;padding:12px 14px;margin:16px 0}.alert-sub b.h{display:block;font-size:16px;color:#0f6b4f;margin-bottom:4px}
  .alert-sub .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.alert-sub input{font:inherit;padding:9px 10px;border:1px solid #cdd;border-radius:8px;box-sizing:border-box}
  .alert-sub input.e{flex:1 1 200px}.alert-sub input.s{flex:1 1 120px}.alert-sub label.lb{flex:1 1 120px;display:flex;align-items:center;gap:6px;font-size:13px;color:#555;white-space:nowrap}.alert-sub input.n{flex:1;min-width:0;width:60px}.alert-sub label.ck{display:flex;gap:6px;align-items:flex-start;font-size:13px;color:#555;margin:6px 0}
  .alert-sub button{background:#0f6b4f;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-size:15px;font-weight:600}.alert-sub .m{font-size:13px;color:#666}`;
  document.head.appendChild(css);
  document.querySelectorAll(".alert-sub").forEach(box => {
    const d = box.dataset;
    box.innerHTML = `<form class="as" novalidate><b class="h">${d.building ? "🔔 " + esc(d.building) + " 有新房通知我" : T("🔔 有新房通知我")}</b>
      <div class="m">${T("有符合条件的新房源上线或降价，第一时间发邮件给你，一天最多一封，随时一键退订。")}</div>
      <div class="row"><input class="s" name="suburb" value="${esc(d.suburb || "")}" placeholder="${T("区（空着 = 全墨尔本）")}">
      <label class="lb">${T("几房起")}<input class="n" name="beds" type="number" inputmode="numeric" min="0" max="10" value="${esc(d.beds || "")}" placeholder="${T("不限")}"></label>
      <label class="lb">${T("周租上限 $")}<input class="n" name="max" type="number" inputmode="numeric" value="${esc(d.max || "")}" placeholder="${T("不限")}"></label></div>
      <div class="row"><input class="e" name="email" type="email" inputmode="email" autocomplete="email" placeholder="${T("你的邮箱")}" required></div>
      <label class="ck"><input type="checkbox" name="consent"> <span>${T("我同意好租 Howzu 按上面的条件给我发房源邮件（每封都能一键退订）。")}</span></label>
      <button style="width:100%">${T("订阅")}</button>
      <input name="website" tabindex="-1" autocomplete="off" style="display:none"><div class="m msg"></div></form>`;
    const f = box.querySelector("form"), msg = f.querySelector(".msg");
    f.onsubmit = async e => {
      e.preventDefault(); if (f.website.value) return;
      const v = { email: f.email.value, consent: f.consent.checked, suburb: f.suburb.value, beds: f.beds.value, max: f.max.value, type: d.type || "any", building: d.building || "", bld: d.bld || "", lang: en() ? "en" : "zh" };
      const err = check(v); if (err) { msg.textContent = T(err); msg.style.color = "#c0392b"; return; }
      const C = window.HOWZU || {}, src = window.HowzuTrack && HowzuTrack.src ? HowzuTrack.src() : "", b = f.querySelector("button"); b.disabled = true;
      try {
        const r = await fetch(`${C.SUPABASE_URL}/rest/v1/listings`, { method: "POST", headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row(v, location.href.split("#")[0], src, new Date().toISOString())) });
        if (!r.ok) throw 0;
        f.innerHTML = `<b class="h">${T("✅ 订阅好了")}</b><div class="m">${T("有符合的新房源会发到你的邮箱。没收到记得看看垃圾邮件箱。")}</div>`;
        try { HowzuTrack.ev("alert:sub"); } catch (_) {}
      } catch (_) { b.disabled = false; msg.style.color = "#c0392b"; msg.textContent = T("没订阅成功，请稍后再试"); }
    };
  });
})();
