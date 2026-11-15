// 在售房源页的咨询小助手：右下角「💬 咨询」→ 一步一步问（想了解什么 → 细节 → 称呼 → 联系方式）→ 存进 listings 表。
// kind = "买房咨询"，status = "pending"：公众读不到，只有后台「需求」里能看到，联系方式不会公开。
// 用法：<script src="/js/sale-chat.js" data-id="sale-19-graham" data-title="19 Graham Court, Altona Meadows" data-lang="zh|en" defer></script>
(function () {
  const me = document.currentScript;
  const ID = me.dataset.id, TITLE = me.dataset.title, EN = me.dataset.lang === "en";
  const T = EN ? {
    btn: "💬 Ask us", head: "Enquiry · " + TITLE, hi: "Hi 👋 What would you like to know about " + TITLE + "?",
    opts: ["Book an inspection", "Statement of Information", "Ask about the home", "Discuss price", "Something else"],
    when: "When suits you?", whenOpts: ["This weekend", "Weekday next week", "Any time"],
    detail: "Anything specific? (optional)", name: "What's your name?", contact: "Your mobile, WeChat or email, so we can get back to you:",
    bad: "Please leave a mobile, WeChat or email.", skip: "Skip", send: "Send", ph: "Type here…",
    done: "Thanks! Frank will be in touch shortly. In a hurry? Call 0431 438 595.", fail: "Sorry, that didn't go through. Please call or SMS 0431 438 595."
  } : {
    btn: "💬 咨询", head: "咨询 · " + TITLE, hi: "你好👋 想了解 " + TITLE + " 的什么？",
    opts: ["预约看房", "要价格说明", "问房子情况", "想谈价格", "其他"],
    when: "哪个时间方便？", whenOpts: ["这个周末", "下周平日", "都可以"],
    detail: "具体想问什么？（可以跳过）", name: "怎么称呼你？", contact: "留个手机、微信或邮箱，我们尽快回复你：",
    bad: "请留一个手机、微信或邮箱", skip: "跳过", send: "发送", ph: "在这里输入…",
    done: "收到！Frank 会尽快联系你。着急的话也可以直接打 0431 438 595。", fail: "没发送成功，麻烦直接打电话或短信 0431 438 595。"
  };
  const css = `.hc-b{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:50;background:#0f6b4f;color:#fff;border:0;border-radius:99px;padding:12px 18px;font:600 15px/1 inherit;box-shadow:0 6px 20px rgba(0,0,0,.2);cursor:pointer}
.hc-p{position:fixed;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:51;width:min(360px,calc(100vw - 24px));max-height:70vh;display:none;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;font-size:14.5px}
.hc-p.on{display:flex}.hc-h{background:#0f6b4f;color:#fff;padding:12px 14px;font-weight:600;display:flex;justify-content:space-between;gap:8px}.hc-h button{background:none;border:0;color:#fff;font-size:20px;line-height:1;cursor:pointer}
.hc-m{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f6f7f6}.hc-m div{max-width:85%;padding:9px 12px;border-radius:14px;line-height:1.45;white-space:pre-line}
.hc-m .bot{background:#fff;border:1px solid #ece9e2;align-self:flex-start}.hc-m .you{background:#0f6b4f;color:#fff;align-self:flex-end}
.hc-o{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0}.hc-o button{border:1.5px solid #0f6b4f;background:#fff;color:#0f6b4f;border-radius:99px;padding:7px 12px;font:600 13.5px inherit;cursor:pointer}
.hc-f{display:flex;gap:6px;padding:10px 12px 12px}.hc-f input{flex:1;min-width:0;border:1px solid #d9d6cf;border-radius:10px;padding:10px;font:inherit}.hc-f button{border:0;background:#0f6b4f;color:#fff;border-radius:10px;padding:0 14px;font:600 14px inherit;cursor:pointer}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const b = document.createElement("button"); b.className = "hc-b"; b.textContent = T.btn; b.dataset.act = "chat"; b.dataset.id = ID;
  const p = document.createElement("div"); p.className = "hc-p";
  p.innerHTML = `<div class="hc-h"><span></span><button aria-label="close">×</button></div><div class="hc-m"></div><div class="hc-o"></div><form class="hc-f"><input autocomplete="off"><button></button></form>`;
  p.querySelector(".hc-h span").textContent = T.head; p.querySelector(".hc-f button").textContent = T.send;
  const M = p.querySelector(".hc-m"), O = p.querySelector(".hc-o"), F = p.querySelector(".hc-f"), I = F.querySelector("input");
  I.placeholder = T.ph;
  document.body.append(b, p);
  const A = {}; let step = 0, started = false, sent = false;
  const say = (t, who) => { const d = document.createElement("div"); d.className = who || "bot"; d.textContent = t; M.appendChild(d); M.scrollTop = 1e6; };
  const opts = (list) => { O.innerHTML = ""; (list || []).forEach(o => { const x = document.createElement("button"); x.type = "button"; x.textContent = o; x.onclick = () => answer(o); O.appendChild(x); }); };
  const ask = () => {
    if (step === 0) { say(T.hi); opts(T.opts); }
    else if (step === 1) { if (A.topic === T.opts[0]) { say(T.when); opts(T.whenOpts); } else { say(T.detail); opts([T.skip]); } }
    else if (step === 2) { say(T.name); opts([T.skip]); }
    else if (step === 3) { say(T.contact); opts([]); }
    I.focus();
  };
  async function answer(v) {
    v = String(v || "").trim(); if (sent) return;
    if (!v) return;
    if (step === 3 && (v.length < 3 || !/[\d@a-zA-Z]/.test(v))) { say(v, "you"); say(T.bad); return; }
    say(v, "you"); I.value = "";
    if (step === 0) A.topic = v; else if (step === 1) A.detail = v === T.skip ? "" : v; else if (step === 2) A.name = v === T.skip ? "" : v; else A.contact = v;
    step++;
    if (step < 4) return ask();
    opts([]); sent = true; F.style.display = "none";
    const ok = await submit(); say(ok ? T.done : T.fail);
  }
  async function submit() {
    const cfg = window.HOWZU || {}; if (!cfg.SUPABASE_URL) return false;
    const c = A.contact, isPhone = /^[+\d][\d\s()-]{7,}$/.test(c) && (c.match(/\d/g) || []).length >= 8;
    const lines = ["买房咨询", `房源：${TITLE}（${ID}）`, `想了解：${A.topic}`, A.detail ? `${A.topic === T.opts[0] ? "时间" : "问题"}：${A.detail}` : "", `称呼：${A.name || "未填"}`, `联系：${c}`, `语言：${EN ? "英文页" : "中文页"}`, `页面：${location.pathname}`].filter(Boolean);
    const row = { status: "pending", kind: "买房咨询", title: `买房咨询 · ${TITLE}`.slice(0, 80), address: TITLE.slice(0, 200), highlights: ["买房咨询"],
      description: lines.join("\n").slice(0, 3000), contact_name: (A.name || "").slice(0, 40) || null, contact_phone: isPhone ? c.slice(0, 30) : null, contact_wechat: isPhone ? null : c.slice(0, 40), photos: [] };
    try {
      const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/listings`, { method: "POST", headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) });
      if (window.HowzuTrack && window.HowzuTrack.act) try { window.HowzuTrack.act("chat-sent", ID); } catch (_) {}
      return r.ok;
    } catch (_) { return false; }
  }
  F.onsubmit = e => { e.preventDefault(); answer(I.value); };
  b.onclick = () => { p.classList.add("on"); b.style.display = "none"; if (!started) { started = true; ask(); } else I.focus(); };
  p.querySelector(".hc-h button").onclick = () => { p.classList.remove("on"); b.style.display = ""; };
})();
