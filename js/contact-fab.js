// 全站右下角“💬 联系我们”：一键打电话 / 发短信，或留电话或微信等我们回电（存进 listings 表，kind = "回电请求"，公众读不到，后台“询盘”里看）。
(function () {
  if (window.__howzuFab) return; window.__howzuFab = 1;
  const C = window.HOWZU || {}, PHONE = "0431438595", esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const p = location.pathname, TOPIC = /landlord|rents|invest|post/.test(p) ? "我是房东" : /sale/.test(p) ? "买房" : "租房";
  const css = `.hzf{position:fixed;right:14px;bottom:18px;z-index:900;border:0;border-radius:24px;padding:12px 16px;background:#0f6b4f;color:#fff;font:600 15px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer}
.hzp{position:fixed;right:10px;left:10px;bottom:10px;max-width:380px;margin-left:auto;z-index:901;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:16px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#1d2321}
.hzp h4{margin:0 0 10px;font-size:17px}.hzp .x{position:absolute;right:10px;top:8px;border:0;background:none;font-size:22px;color:#888;cursor:pointer}
.hzp .q{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.hzp .q a{display:block;text-align:center;padding:11px;border-radius:10px;background:#f4faf7;border:1px solid #cfe6d8;color:#0f6b4f;font-weight:600;text-decoration:none}
.hzp input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid #d6dcd9;border-radius:10px;margin-bottom:8px}
.hzp .t{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.hzp .t button{border:1px solid #d6dcd9;background:#fff;border-radius:16px;padding:6px 12px;font:inherit;font-size:14px;cursor:pointer}.hzp .t button.on{background:#0f6b4f;color:#fff;border-color:#0f6b4f}
.hzp .go{width:100%;border:0;border-radius:10px;padding:12px;background:#0f6b4f;color:#fff;font:600 16px inherit;font-family:inherit;cursor:pointer}.hzp .m{font-size:12.5px;color:#5d6461;margin-top:6px}`;
  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: css }));
  const fab = Object.assign(document.createElement("button"), { className: "hzf", type: "button", textContent: "💬 联系我们" });
  document.body.appendChild(fab);
  // 页面底部已有固定按钮条（房源页的电话 / 预约看房）时，往上挪，避免挡住
  const lift = () => { let h = 0; document.querySelectorAll("body *").forEach(e => { if (e === fab || e.closest(".hzp")) return; const s = getComputedStyle(e); if (s.position === "fixed" && s.display !== "none" && parseFloat(s.bottom) <= 1 && e.offsetHeight < 200 && e.offsetWidth > innerWidth * .6) h = Math.max(h, e.offsetHeight); }); fab.style.bottom = (18 + h) + "px"; };
  setTimeout(lift, 800); addEventListener("resize", lift);
  let panel;
  fab.onclick = () => {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement("div"); panel.className = "hzp";
    panel.innerHTML = `<button class="x" aria-label="关闭">×</button><h4>有问题？我们回电给你</h4>
      <div class="q"><a href="tel:${PHONE}" data-act="call">📞 直接打电话</a><a href="sms:${PHONE}" data-act="sms">💬 发短信</a></div>
      <form><div class="t">${["租房", "我是房东", "买房", "其他"].map(t => `<button type="button" class="${t === TOPIC ? "on" : ""}">${t}</button>`).join("")}</div>
      <input name="c" placeholder="你的电话或微信号" autocomplete="tel" required><input name="n" placeholder="称呼（可不填）" autocomplete="name"><input name="website" tabindex="-1" autocomplete="off" style="display:none">
      <button class="go">请回电给我</button><div class="m">一般 1 个工作日内联系你。联系方式只有好租工作人员能看到。</div></form>`;
    document.body.appendChild(panel);
    const f = panel.querySelector("form"), tb = panel.querySelector(".t");
    panel.querySelector(".x").onclick = () => fab.onclick();
    tb.onclick = e => { if (e.target.tagName !== "BUTTON") return; tb.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.target)); };
    f.onsubmit = async e => {
      e.preventDefault(); const c = f.c.value.trim(), m = panel.querySelector(".m");
      if (c.length < 5) { m.textContent = "请留一个电话或微信号"; return; }
      if (f.website.value) return;
      const topic = (tb.querySelector(".on") || {}).textContent || "其他", src = window.HowzuTrack && HowzuTrack.src ? HowzuTrack.src() : "";
      const phone = /^[+\d][\d\s()-]{7,}$/.test(c);
      const row = { status: "pending", kind: "回电请求", title: `回电请求 · ${topic}`.slice(0, 80), address: `回电请求：${p}`.slice(0, 200), highlights: ["回电请求", topic], photos: [],
        description: [`想了解：${topic}`, `称呼：${f.n.value.trim() || "未填"}`, `联系：${c}`, `页面：${location.href}`, src ? `渠道：${src}` : ""].filter(Boolean).join("\n").slice(0, 3000),
        contact_phone: phone ? c.slice(0, 30) : null, contact_wechat: phone ? null : c.slice(0, 40) };
      const b = f.querySelector(".go"); b.disabled = true;
      try {
        const r = await fetch(`${C.SUPABASE_URL}/rest/v1/listings`, { method: "POST", headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) });
        if (!r.ok) throw 0;
        f.innerHTML = `<div style="color:#0f6b4f;font-weight:600;padding:8px 0">✅ 收到了！我们会尽快回电。</div>`;
        try { HowzuTrack.ev("callback:" + topic); } catch (_) {}
      } catch (_) { b.disabled = false; m.textContent = "没提交成功，请直接打电话 " + PHONE; }
    };
  };
})();
