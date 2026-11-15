// 后台“贴帖入库”（房东授权版）：先征得房东同意 → 粘贴文字、拖入照片 → 自动整理成草稿（不公开）→ 生成房东确认链接和话术。
// 识别用 js/post-parse.js（规则识别，不花 API 额度），识别不出的标“待确认”，不编。照片压缩方式同 post.html（长边 1600、JPEG 0.85）。
// 房东电话、微信只存进私密表 listing_owners，不进公开可读的 listings；上线后咨询统一走好租。
const KINDS = ["整套出租", "单间出租", "转租 / 顶租约", "短租"], FURN = ["带家具", "不带家具", "部分家具"];
const SITE = "https://howzu.com.au";
let S = { photos: [], x: null, done: null };

async function shrink(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w, h, src;
  if (bmp) { w = bmp.width; h = bmp.height; src = bmp; }
  else { const img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); w = img.naturalWidth; h = img.naturalHeight; src = img; }
  const k = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
}
const token = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
export const confirmLink = (id, t) => `${SITE}/confirm.html?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;

export async function loadImport({ sb, $, esc, head, C }) {
  const P = window.PostParse;
  const { data: drafts, error } = await sb.from("listings").select("id,title,created_at,photos").eq("kind", "待房东确认").order("created_at", { ascending: false }).limit(50);
  const own = error ? null : await sb.from("listing_owners").select("listing_id,token,source,contact_name,created_at");
  const tableMissing = own && own.error;
  const tok = new Map(((own && own.data) || []).map(o => [o.listing_id, o]));
  $("#app").innerHTML = head + (tableMissing ? `<div class="tbc">还没开通贴帖入库：请在 Supabase 的 SQL Editor 运行一次 <b>supabase/import.sql</b>（建私密表和房东确认功能，不改现有表）。</div>` : "") + `
  <div class="card">
    <div class="t">① 先征得房东同意（复制发给发帖人）</div>
    <div class="desc" id="askT">${esc(P.askMsg())}</div>
    <div class="acts"><button class="gr" data-cp="#askT">复制话术</button></div>
    <div class="m">对方同意后再往下做。不要搬没同意的帖子和照片。</div>
  </div>
  <div class="card">
    <div class="t">② 粘贴帖子文字 + 拖入照片</div>
    <div class="edit">
      <label>来源</label><div class="acts" id="src">${["微信群", "小红书", "Facebook", "其它"].map((s, i) => `<button class="${i ? "gr" : "ok"}" data-src="${s}">${s}</button>`).join("")}</div>
      <label>帖子文字 <small>粘贴后自动识别</small></label><textarea id="ptxt" rows="7" placeholder="把房东发来的文字整段粘贴进来"></textarea>
      <label>照片 <small>点这里选，或把照片拖进来（最多 15 张，自动压缩）</small></label>
      <div id="drop" style="border:2px dashed #cfd8d4;border-radius:12px;padding:14px;text-align:center;color:#6b726f;cursor:pointer">＋ 选照片 / 拖进来</div>
      <input id="pf" type="file" accept="image/*" multiple hidden>
      <div class="eph" id="pg" style="margin-top:8px"></div>
      <label>征得同意的记录 <small>可选，例如“11/15 微信私信同意”</small></label><input id="consent">
    </div>
    <div id="pv"></div>
  </div>
  <div id="out"></div>
  <div class="card"><div class="t">等房东确认的草稿（${(drafts || []).length}）</div>${(drafts || []).length ? drafts.map(d => { const o = tok.get(d.id); return `<div class="m" style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px"><span>${esc(d.title)} · ${esc((o && o.source) || "")} · ${new Date(d.created_at).toLocaleDateString("zh-CN")}</span>${o ? `<button class="gr" data-copytext="${esc(P.confirmMsg(confirmLink(d.id, o.token)))}">复制确认话术</button>` : ""}</div>`; }).join("") : '<div class="m">还没有。</div>'}</div>`;
  S = { photos: [], x: null, done: null, src: "微信群" };
  const pg = $("#pg"), pf = $("#pf"), drop = $("#drop");
  const renderPh = () => { pg.innerHTML = S.photos.map((p, i) => `<div class="ep"><img src="${p.url}">${i === 0 ? "<span>封面</span>" : `<button data-cover="${i}">设为封面</button>`}<button class="rm" data-rm="${i}">×</button></div>`).join(""); };
  const add = async files => { for (const f of files) { if (S.photos.length >= 15) break; if (!f.type.startsWith("image/")) continue; const p = { url: URL.createObjectURL(f), blob: null }; S.photos.push(p); renderPh(); try { p.blob = await shrink(f); } catch (_) { p.blob = f; } } renderPh(); };
  drop.onclick = () => pf.click(); pf.onchange = () => add([...pf.files]);
  drop.ondragover = e => { e.preventDefault(); drop.style.background = "#eef7f1"; }; drop.ondragleave = () => drop.style.background = "";
  drop.ondrop = e => { e.preventDefault(); drop.style.background = ""; add([...e.dataTransfer.files]); };
  pg.onclick = e => { const r = e.target.dataset.rm, c = e.target.dataset.cover; if (r != null) S.photos.splice(+r, 1); if (c != null) S.photos.unshift(...S.photos.splice(+c, 1)); renderPh(); };
  $("#src").onclick = e => { const s = e.target.dataset.src; if (!s) return; S.src = s; [...$("#src").children].forEach(b => b.className = b.dataset.src === s ? "ok" : "gr"); };
  const form = x => `<div class="edit" style="margin-top:12px">
      ${x.missing.length ? `<div class="tbc">📋 待确认（原帖没写，房东在确认页补）：${x.missing.map(esc).join("、")}</div>` : `<div class="tbc ok">信息齐全</div>`}
      ${x.rentNote ? `<div class="tbc">💰 ${esc(x.rentNote)}</div>` : ""}
      <label>标题</label><input id="f_title" value="${esc(x.title)}">
      <label>类型</label><select id="f_kind" style="width:100%;font-size:16px;padding:10px;border-radius:10px">${KINDS.map(k => `<option${k === x.kind ? " selected" : ""}>${k}</option>`).join("")}</select>
      <label>区域</label><input id="f_suburb" value="${esc(x.suburb || "")}" placeholder="待确认">
      <label>地址 <small>只写到街名也行；房东在确认页补全</small></label><input id="f_addr" value="${esc(x.address || "")}" placeholder="待确认">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        <div><label>周租 $</label><input id="f_rent" inputmode="numeric" value="${x.rent_weekly || ""}" placeholder="待确认"></div>
        <div><label>卧室</label><input id="f_beds" inputmode="numeric" value="${x.beds ?? ""}" placeholder="?"></div>
        <div><label>卫生间</label><input id="f_baths" inputmode="numeric" value="${x.baths ?? ""}" placeholder="?"></div>
        <div><label>车位</label><input id="f_cars" inputmode="numeric" value="${x.cars ?? ""}" placeholder="?"></div>
      </div>
      <label>可入住</label><input id="f_avail" value="${esc(x.available || "")}" placeholder="待确认">
      <label>家具</label><select id="f_furn" style="width:100%;font-size:16px;padding:10px;border-radius:10px"><option value="">待确认</option>${FURN.map(k => `<option${k === x.furnished ? " selected" : ""}>${k}</option>`).join("")}</select>
      <label>标签 <small>租期、押金、宠物、水电网、设施、卖点，用逗号隔开</small></label><input id="f_hl" value="${esc(x.highlights.join("，"))}">
      <label>描述 <small>已去掉个人电话和微信号</small></label><textarea id="f_desc" rows="5">${esc(x.description)}</textarea>
      <label>房东联系方式 <small>只存在私密表，不公开；询盘由好租转给房东</small></label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><input id="f_cn" placeholder="称呼"><input id="f_ph" value="${esc(x.contact.phone || "")}" placeholder="电话"><input id="f_wx" value="${esc(x.contact.wechat || "")}" placeholder="微信"></div>
      <div class="acts"><button class="ok" id="save">保存草稿并生成确认链接</button></div><div class="m" id="serr" style="color:#a12b2b"></div>
    </div>`;
  let tm; $("#ptxt").oninput = () => { clearTimeout(tm); tm = setTimeout(() => { const v = $("#ptxt").value.trim(); if (!v) { $("#pv").innerHTML = ""; return; } S.x = P.parse(v); $("#pv").innerHTML = form(S.x); }, 250); };
  $("#pv").onclick = async e => {
    if (e.target.id !== "save") return;
    const btn = e.target, err = $("#serr"); err.textContent = "";
    const v = id => $("#" + id).value.trim(), n = id => v(id) === "" ? null : +v(id);
    if (!S.photos.length) { err.textContent = "至少放一张照片（房东同意使用的）。"; return; }
    if (S.photos.some(p => !p.blob)) { err.textContent = "照片还在压缩，等一秒再点。"; return; }
    const addr = v("f_addr") || `地址待确认 · ${v("f_suburb") || "墨尔本"}`;
    btn.disabled = true;
    try {
      const folder = "import/" + new Date().toISOString().slice(0, 10) + "/" + crypto.randomUUID(), urls = [];
      for (let i = 0; i < S.photos.length; i++) {
        btn.textContent = `上传照片 ${i + 1}/${S.photos.length}`;
        const path = `${folder}/${i + 1}.jpg`;
        const { error } = await sb.storage.from(C.BUCKET).upload(path, S.photos[i].blob, { contentType: "image/jpeg" });
        if (error) throw error;
        urls.push(sb.storage.from(C.BUCKET).getPublicUrl(path).data.publicUrl);
      }
      btn.textContent = "保存中…";
      const rent = n("f_rent");
      const row = { status: "pending", kind: "待房东确认", title: (v("f_title") || "墨尔本房源").slice(0, 80).padEnd(4, " "), address: addr.slice(0, 200), suburb: v("f_suburb") || null,
        beds: n("f_beds"), baths: n("f_baths"), cars: n("f_cars"), rent_weekly: rent >= 50 ? rent : null, available: v("f_avail") || null, furnished: v("f_furn") || null,
        highlights: v("f_hl").split(/[,，、]\s*/).map(s => s.trim()).filter(Boolean).slice(0, 30), description: v("f_desc").slice(0, 3000) || null,
        photos: urls, review_note: `贴帖入库 · 来源 ${S.src}` + (S.x && S.x.missing.length ? ` · 待确认：${S.x.missing.join("、")}` : "") };
      const { data: ins, error: e1 } = await sb.from("listings").insert(row).select("id").single();
      if (e1) throw e1;
      const t = token();
      const { error: e2 } = await sb.from("listing_owners").insert({ listing_id: ins.id, token: t, contact_name: v("f_cn") || null, contact_phone: v("f_ph") || null, contact_wechat: v("f_wx") || null, source: S.src, consent_note: v("consent") || null });
      if (e2) { await sb.from("listings").delete().eq("id", ins.id); throw e2; }
      const link = confirmLink(ins.id, t), msg = P.confirmMsg(link);
      $("#out").innerHTML = `<div class="just"><b>✓ 草稿已保存（没有公开）</b><div class="m">把下面这段发给房东。房东确认、填好周租后，会出现在“待审核”里，你再审核上线。</div><div class="desc" id="cmsg">${esc(msg)}</div><div class="acts"><button class="ok" data-cp="#cmsg">复制确认话术</button><a class="gr" style="padding:10px 14px;border-radius:10px;text-decoration:none" href="${esc(link)}" target="_blank">预览确认页</a><button class="gr" data-tab="import">再贴一条</button></div></div>`;
      $("#out").scrollIntoView({ behavior: "smooth" });
      btn.textContent = "已保存";
    } catch (ex) { btn.disabled = false; btn.textContent = "保存草稿并生成确认链接"; err.textContent = "保存失败：" + (ex.message || ex); }
  };
}
