// 房东卡片“我是房东：我的房能租多少？”：选区和房型 → 显示政府公开的周租中位数 → 一键免费上架（预填 post.html）或留联系方式找托管。
// 数据只用 data/rent_check.json（DFFH 租金报告，CC BY 4.0），只有中位数，不编区间。放在页面里：<div id="llCard" data-suburb="Box Hill"></div>
(function () {
  const el = document.getElementById("llCard"); if (!el) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const TYPES = [["2 bedroom flat", "2 房公寓", 2, "公寓"], ["1 bedroom flat", "1 房公寓", 1, "公寓"], ["3 bedroom flat", "3 房公寓", 3, "公寓"], ["2 bedroom house", "2 房独立屋", 2, "独立屋"], ["3 bedroom house", "3 房独立屋", 3, "独立屋"], ["4 bedroom house", "4 房独立屋", 4, "独立屋"]];
  const css = `#llCard{margin:22px 0;border:1px solid #cfe6d8;background:#f4faf7;border-radius:14px;padding:16px;font-size:15px;line-height:1.6;color:#1d2321}
#llCard h3{margin:0 0 10px;font-size:17px;color:#0f6b4f}#llCard select,#llCard input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid #d6dcd9;border-radius:10px;background:#fff;margin-bottom:8px}
#llCard .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}#llCard .big{font-size:26px;font-weight:700;color:#0f6b4f}#llCard .m{font-size:12.5px;color:#5d6461}
#llCard .b{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}#llCard .b a,#llCard .b button{flex:1 1 140px;text-align:center;padding:12px;border-radius:10px;font:600 15px inherit;font-family:inherit;text-decoration:none;cursor:pointer;border:1px solid #0f6b4f}
#llCard .p{background:#0f6b4f;color:#fff}#llCard .s{background:#fff;color:#0f6b4f}#llCard .ok{color:#0f6b4f;font-weight:600}`;
  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: css }));
  el.innerHTML = `<h3>🔑 我是房东：我的房能租多少？</h3><div class="m">加载中…</div>`;
  fetch("/data/rent_check.json").then(r => r.json()).then(D => {
    const G = D.groups.slice().sort((a, b) => a.name.localeCompare(b.name));
    const want = (el.dataset.suburb || "").toLowerCase();
    let gi = Math.max(0, G.findIndex(g => g.name.toLowerCase() === want || (g.suburbs || []).some(s => s.toLowerCase() === want)));
    if (!want) gi = Math.max(0, G.findIndex(g => g.name === "Melbourne"));
    el.innerHTML = `<h3>🔑 我是房东：我的房能租多少？</h3>
      <div class="g2"><select id="llS" aria-label="区">${G.map((g, i) => `<option value="${i}"${i === gi ? " selected" : ""}>${esc(g.name)}</option>`).join("")}</select>
      <select id="llT" aria-label="房型">${TYPES.map((t, i) => `<option value="${i}">${t[1]}</option>`).join("")}</select></div>
      <div id="llR"></div>
      <div class="b"><a class="p" id="llPost" href="/post.html">免费上架到好租</a><button class="s" id="llMg" type="button">想找人托管</button></div>
      <form id="llF" hidden style="margin-top:10px"><input name="contact" placeholder="微信号或手机" autocomplete="tel" required><input name="website" tabindex="-1" autocomplete="off" style="display:none"><button class="p" style="width:100%;padding:12px;border:0;border-radius:10px;font:600 15px inherit;font-family:inherit">提交，我们联系你</button><div class="m" id="llM"></div></form>`;
    const S = el.querySelector("#llS"), T = el.querySelector("#llT");
    function show() {
      const g = G[+S.value], t = TYPES[+T.value], r = (g.rents || {})[t[0]];
      const q = D.rent_quarter ? D.rent_quarter.replace("-", " 年 ") + " 月" : "";
      el.querySelector("#llR").innerHTML = r && r.now ? `<div class="big">约 $${r.now} / 周</div><div class="m">${esc(g.name)} ${t[1]}过去一年新租约的周租中位数（${r.lettings || "?"} 套），截至 ${q}。数据：维州政府 DFFH 租金报告。<b>这是参考价，不是正式评估</b>，实际租金看装修、楼层和朝向。</div>`
        : `<div class="m">${esc(g.name)} 这个房型政府数据里没有足够样本。可以换个房型看看，或者直接免费上架，我们帮你定价。</div>`;
      const sub = (g.suburbs && g.suburbs[0] ? g.suburbs[0] : g.name).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      el.querySelector("#llPost").href = `/post.html?suburb=${encodeURIComponent(sub)}&beds=${t[2]}&ptype=${encodeURIComponent(t[3])}${r && r.now ? "&rent=" + r.now : ""}&from=rents`;
    }
    S.onchange = T.onchange = show; show();
    el.querySelector("#llMg").onclick = () => { el.querySelector("#llF").hidden = false; el.querySelector("#llF input").focus(); };
    el.querySelector("#llPost").onclick = () => { try { HowzuTrack.ev("ll-post:" + G[+S.value].name); } catch (_) {} };
    el.querySelector("#llF").onsubmit = async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), g = G[+S.value], t = TYPES[+T.value], m = el.querySelector("#llM");
      if (!window.HowzuOwner) { m.textContent = "暂时提交不了，请直接打电话联系我们"; return; }
      const r = await HowzuOwner.submit({ contact: f.contact, website: f.website, area: g.name, type: t[3], beds: t[2], other: "估租金看到的参考价：" + (((g.rents || {})[t[0]] || {}).now ? "$" + g.rents[t[0]].now + "/周" : "无"), ref: "租金查询-房东 · " + location.pathname });
      if (r.ok) { e.target.innerHTML = `<div class="ok">✅ 收到了！我们会尽快联系你。</div>`; try { HowzuTrack.ev("owner-lead:rents"); } catch (_) {} } else m.textContent = r.error;
    };
    window.HowzuLL = { set: name => { const i = G.findIndex(g => g.name === name); if (i >= 0) { S.value = i; show(); } } };
  }).catch(() => { el.innerHTML = ""; });
})();
