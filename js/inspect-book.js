// 代看房预约（先手工接单，不在线收款）：存进 listings 表，kind = "代看房"，status = "pending"（公众读不到），后台“询盘”里可单独筛选。
// 页面放 <div id="ibook"></div>；房源页链接 /guide/study-abroad.html?house=<房源 id>#book 会自动填上房源。
(function () {
  const KIND = "代看房";
  const T = s => (window.HowzuLang ? HowzuLang.t(s) : s);
  // 纯函数：表单值 → 要存的行（Node 测试也用）
  function row(v, page, src) {
    const c = String(v.contact || "").trim(), what = String(v.house || "").trim(), when = String(v.when || "").trim();
    const phone = /^[+\d][\d\s()-]{7,}$/.test(c);
    return { status: "pending", kind: KIND, title: ("代看房预约 · " + (what || "未填房源")).slice(0, 80), address: ("代看房：" + (what || "未填房源")).slice(0, 200),
      highlights: ["代看房", v.live ? "要视频直播" : "照片视频报告"], photos: [],
      description: ["想看的房源：" + (what || "未填"), "时间：" + (when || "未填"), "视频直播看房：" + (v.live ? "要" : "不用"), "联系：" + c, "页面：" + page, src ? "渠道：" + src : ""].filter(Boolean).join("\n").slice(0, 3000),
      contact_phone: phone ? c.slice(0, 30) : null, contact_wechat: phone ? null : c.slice(0, 40) };
  }
  function check(v) {
    if (String(v.house || "").trim().length < 5) return "请填房源链接或地址";
    if (String(v.contact || "").trim().length < 5) return "请留微信号、邮箱或电话";
    return "";
  }
  if (typeof module !== "undefined") { module.exports = { row, check, KIND }; return; }
  const box = document.getElementById("ibook"); if (!box) return;
  const C = window.HOWZU || {}, PHONE = "0431438595";
  const q = new URLSearchParams(location.search), house = q.get("house") || "";
  const pre = house ? (/^https?:/.test(house) ? house : "https://howzu.com.au/rent/" + house + ".html") : "";
  box.innerHTML = `<form novalidate>
    <input name="house" placeholder="${T("想看的房源链接或地址")}" value="${pre.replace(/"/g, "&quot;")}" required>
    <input name="when" placeholder="${T("希望什么时候看（例：12 月第一周）")}">
    <input name="contact" placeholder="${T("微信号或邮箱（电话也行）")}" required>
    <label class="ck"><input type="checkbox" name="live"> ${T("要视频直播看房")}</label>
    <input name="website" tabindex="-1" autocomplete="off" style="display:none">
    <button class="go">${T("提交预约，先报价")}</button><div class="m">${T("1 个工作日内用微信或邮件回复你报价。联系方式只有好租工作人员能看到。")}</div></form>`;
  const f = box.querySelector("form"), m = box.querySelector(".m");
  if (pre) try { HowzuTrack.ev("inspect:open"); } catch (_) {}
  f.onsubmit = async e => {
    e.preventDefault(); if (f.website.value) return;
    const v = { house: f.house.value, when: f.when.value, contact: f.contact.value, live: f.live.checked }, err = check(v);
    if (err) { m.textContent = T(err); m.style.color = "#c0392b"; return; }
    const src = window.HowzuTrack && HowzuTrack.src ? HowzuTrack.src() : "", b = f.querySelector(".go"); b.disabled = true;
    try {
      const r = await fetch(`${C.SUPABASE_URL}/rest/v1/listings`, { method: "POST", headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row(v, location.href, src)) });
      if (!r.ok) throw 0;
      f.innerHTML = `<div style="color:#0f6b4f;font-weight:600;padding:8px 0">${T("✅ 收到了！我们会尽快把报价发给你。")}</div>`;
      try { HowzuTrack.ev("inspect:book"); } catch (_) {}
    } catch (_) { b.disabled = false; m.style.color = "#c0392b"; m.textContent = T("没提交成功，请直接电话或短信") + " " + PHONE; }
  };
})();
