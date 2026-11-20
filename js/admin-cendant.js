// 后台“📋 待上线（Cendant）”：data/listings.json 里 status=draft 且有 cendantDraft 的房源。
// 点“上线”= 用 GitHub 接口把这一套改成 live（可先改周租），GitHub Actions 1–2 分钟内重建房源页。
// GitHub 令牌只存在 Frank 自己的浏览器（localStorage），不进仓库、不进数据库。
(function () {
  const REPO = "pbz13p/howzu", FILE = "data/listings.json", KEY = "howzu-gh-token";
  // 纯函数（Node 测试也用）：把某套改成上线，返回新 JSON 文本；租金必填（维州 s30F）
  function publish(text, id, rent, today) {
    const d = JSON.parse(text), x = d.listings.find(l => l.id === id);
    if (!x) throw new Error("找不到房源 " + id);
    if (x.status !== "draft") throw new Error("这套已经不是草稿了（" + x.status + "）");
    const r = Math.round(+rent);
    if (!(r >= 100 && r <= 5000)) throw new Error("周租要填 100–5000 之间的数字");
    x.status = "live"; x.rentWeekly = r; x.verified = today; delete x.cendantDraft;
    return JSON.stringify(d, null, 1) + "\n";
  }
  function drafts(d) { return (d.listings || []).filter(x => x.status === "draft" && x.cendantDraft); }
  if (typeof module !== "undefined") { module.exports = { publish, drafts }; return; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const b64 = s => btoa(unescape(encodeURIComponent(s))), unb64 = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ""))));
  async function gh(token, method, body) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, { method, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }, body: body && JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "GitHub 令牌无效或没有写权限，点“换令牌”重新填" : "GitHub 返回 " + r.status);
    return r.json();
  }
  window.loadCendant = async function ({ $, head }) {
    const box = $("#app");
    box.innerHTML = head + `<div class="m">加载中…</div>`;
    let d; try { d = await (await fetch("/data/listings.json?t=" + Date.now())).json(); } catch (_) { box.innerHTML = head + `<div class="m">读不到 data/listings.json</div>`; return; }
    const L = drafts(d);
    box.innerHTML = head + `<div class="m" style="margin:0 2px 10px">Cendant 自己管的房，租客要搬走或租约 45 天内到期没续约时，Claude 每周四把它放进这里。确认周租后点“上线”，1–2 分钟后网站更新。<button class="gr" data-tok>换令牌</button></div>` +
      (L.length ? L.map(x => `<div class="card" style="padding:10px 12px;margin-bottom:8px">
        <b>${esc(x.title)}</b> <span class="m">${esc(x.suburb)} · ${x.beds} 房 ${x.baths} 卫${x.cars ? " · " + x.cars + " 车位" : ""} · ${(x.photos || []).length} 张照片</span>
        <div class="m">可入住 ${esc(x.available || "未填")} · ${esc(x.cendantDraft.reason || "")}${(x.photos || []).length ? "" : " · ⚠️ 没照片，上线前最好补"}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px">周租 $<input type="number" inputmode="numeric" value="${esc(x.rentWeekly || "")}" data-rent="${esc(x.id)}" style="width:90px">
        <button class="ok" data-pub="${esc(x.id)}">上线</button><a href="/rent/${esc(x.id)}.html" target="_blank" class="m">预览</a></div></div>`).join("")
        : `<div class="m">现在没有待上线的 Cendant 房。</div>`);
    box.onclick = async e => {
      const t = e.target;
      if (t.hasAttribute("data-tok")) { localStorage.removeItem(KEY); alert("已清除，下次点“上线”时会请你重新填。"); return; }
      const id = t.dataset.pub; if (!id) return;
      let token = localStorage.getItem(KEY);
      if (!token) { token = prompt("第一次用：粘贴 GitHub 令牌（做法见 ROADMAP「待 Frank 处理」F13）。只存在这台电脑的浏览器里。"); if (!token) return; localStorage.setItem(KEY, token.trim()); token = token.trim(); }
      const rent = box.querySelector(`[data-rent="${CSS.escape(id)}"]`).value;
      t.disabled = true; t.textContent = "上线中…";
      try {
        const cur = await gh(token, "GET");
        const next = publish(unb64(cur.content), id, rent, new Date().toISOString().slice(0, 10));
        await gh(token, "PUT", { message: `上线 Cendant 房源 ${id}（后台一键上线）`, content: b64(next), sha: cur.sha });
        t.textContent = "✅ 已上线，1–2 分钟后网站更新";
      } catch (err) { t.disabled = false; t.textContent = "上线"; alert(err.message); }
    };
  };
})();
