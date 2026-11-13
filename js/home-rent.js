// 首页“正在招租”横滑卡片：从 data/listings.json 挑在租房源（纯函数，tools/test-home-rent.js 测试）
(function (g) {
  const isNow = x => /尽快|马上|即|now/i.test(x.available || "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 只要 live；马上能住的排前面，其余保持原顺序
  function pick(list) {
    return (list || []).filter(x => x && x.status === "live").map((x, i) => [x, i])
      .sort((a, b) => (isNow(b[0]) - isNow(a[0])) || a[1] - b[1]).map(p => p[0]);
  }
  // 有独立页（rent/<id>.html）就链过去，否则打开租房页详情
  const href = x => /^[\w-]+$/.test(x.id) ? `rent/${x.id}.html` : `rentals.html?id=${encodeURIComponent(x.id)}`;
  // 本站照片用 480 宽小图（tools/make_thumbs.py 生成），小图缺了就退回原图
  const small = p => /^\/?photos\/[^/]+\.(jpe?g|png|webp)$/i.test(String(p)) ? String(p).replace(/^(\/?photos\/)([^/]+)\.\w+$/i, "$1s/$2.jpg") : p;
  function card(x, i) {
    const t = String(x.title || x.suburb || "").split("·")[0].trim();
    const sub = [x.beds != null ? `${x.beds} 房` : "", x.baths != null ? `${x.baths} 卫` : "", String(x.suburb || "").replace(/ CBD$/, "")].filter(Boolean).join(" · ");
    const price = x.rentWeekly ? `<span class="hr-p">$${esc(x.rentWeekly)}<small>/周</small></span>` : `<span class="hr-p q">租金面议</span>`;
    const tag = isNow(x) ? "马上入住" : x.available ? `${x.available}入住` : "";
    return `<a class="hr-c" href="${esc(href(x))}"><span class="hr-i"><img src="${esc(small((x.photos || [])[0] || ""))}" data-o="${esc((x.photos || [])[0] || "")}" onerror="if(this.dataset.o&&this.src.indexOf(this.dataset.o)<0)this.src=this.dataset.o" width="480" height="360" alt="${esc(t)}"${i > 1 ? ' loading="lazy"' : ""}>${tag ? `<em>${esc(tag)}</em>` : ""}</span><b>${esc(t)}</b><span class="hr-s">${esc(sub)}</span>${price}</a>`;
  }
  function html(list) { const L = pick(list); return { n: L.length, cards: L.slice(0, 8).map((x, i) => card(x, i)).join("") }; }
  const api = { pick, href, card, html, small };
  if (typeof module !== "undefined") module.exports = api; else g.HomeRent = api;
})(this);
