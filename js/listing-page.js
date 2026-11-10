// 每套房一个独立静态页（rent/<id>.html）：给微信 / 小红书 / Google 抓标题、首图、描述用。
// 纯函数，Node 和浏览器都能用；由 tools/build-listing-pages.js 生成文件。
(function (root) {
  const SITE = "https://howzu.com.au";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hideUnit = a => String(a || "").replace(/^\s*[\w-]+\s*\/\s*/, "");
  const isLet = x => x.status === "let";
  const pageUrl = x => `${SITE}/rent/${encodeURIComponent(x.id)}.html`;
  const fmtTel = t => String(t || "").replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");

  function facts(x) {
    return [x.beds != null ? `${x.beds}房` : "", x.baths != null ? `${x.baths}卫` : "", x.cars ? `${x.cars}车位` : ""].filter(Boolean).join("");
  }
  function priceText(x) {
    if (isLet(x)) return "已租出";
    return x.rentWeekly ? `$${x.rentWeekly}/周` : "租金咨询";
  }
  // 分享卡片标题：区 · 几房几卫 · 租金
  function ogTitle(x) {
    return [x.title || x.suburb || "墨尔本房源", isLet(x) ? "已租出" : x.rentWeekly ? `$${x.rentWeekly}/周` : ""].filter(Boolean).join(" · ") + " | 好租 Howzu";
  }
  // 分享卡片描述：关键信息 + 介绍第一句，限 110 字
  function ogDesc(x) {
    const head = [x.suburb, facts(x), isLet(x) ? "已租出" : x.available ? `${x.available}入住` : "", x.furnished === true ? "带家具" : ""].filter(Boolean).join(" · ");
    const first = String(x.desc || "").split(/\n/).map(s => s.trim()).filter(Boolean)[0] || "";
    const s = head + (first ? "。" + first : "") + " 好租 Howzu 中文服务，持牌管理。";
    return s.length > 110 ? s.slice(0, 109) + "…" : s;
  }
  function ogImage(x) {
    const p = (x.photos || [])[0];
    if (!p) return `${SITE}/icons/og-share.jpg`;
    return /^https?:/.test(p) ? p : `${SITE}/${String(p).replace(/^\//, "")}`;
  }
  // 关键信息栏：押金 / 可入住 / 租期 / 看房。押金、租期、看房来自发房源时存进 highlights 的标签；
  // 没填的写"咨询"，不编数据。返回 { cells:[[标签,值]], rest:剩下的普通亮点 }
  const KEY = [["押金", /^押金\s*/], ["租期", /^租期\s*/], ["看房", /^看房\s*/]];
  function keyFacts(x) {
    const hs = (x.highlights || []).map(String), got = {};
    const rest = hs.filter(h => { const k = KEY.find(([, re]) => re.test(h)); if (k && !got[k[0]]) { got[k[0]] = h.replace(k[1], "").trim(); return false; } return true; });
    const avail = isLet(x) ? "已租出" : x.available ? String(x.available).replace(/入住$/, "") : "咨询";
    const cells = [["押金", got["押金"] || "咨询"], ["可入住", avail], ["租期", got["租期"] || "咨询"], ["看房", got["看房"] || "预约看房"]];
    return { cells, rest };
  }
  const rel = p => /^https?:/.test(p) ? p : "../" + String(p).replace(/^\//, "");

  function render(x, contact) {
    contact = contact || {};
    const tel = x.phone || contact.phone, wx = x.wechat || contact.wechat;
    const P = x.photos || [];
    const t = ogTitle(x), d = ogDesc(x), img = ogImage(x), url = pageUrl(x);
    const full = `../rentals.html?id=${encodeURIComponent(x.id)}`;
    const msg = encodeURIComponent(`你好，我在好租 Howzu 看到房源：${x.title}（${url}）`);
    const ld = {
      "@context": "https://schema.org", "@type": "Apartment", name: x.title, url, image: P.map(p => ogImage({ photos: [p] })),
      address: { "@type": "PostalAddress", streetAddress: hideUnit(x.address), addressLocality: x.suburb, addressRegion: "VIC", addressCountry: "AU" },
    };
    if (x.beds != null) ld.numberOfRooms = x.beds;
    if (x.baths != null) ld.numberOfBathroomsTotal = x.baths;
    const tags = [
      x.beds != null ? `🛏 ${x.beds} 房` : "", x.baths != null ? `🛁 ${x.baths} 卫` : "", x.cars != null ? `🚗 ${x.cars ? x.cars + " 车位" : "无车位"}` : "",
    ].filter(Boolean);
    const kf = keyFacts(x);
    const chips = [x.furnished === true ? "带家具" : x.furnished === false ? "不带家具" : x.furnished === "部分家具" ? "部分家具" : "", ...kf.rest].filter(Boolean);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(d)}">
<link rel="canonical" href="${esc(url)}">
${isLet(x) ? '<meta name="robots" content="noindex">\n' : ""}<meta property="og:type" content="website">
<meta property="og:site_name" content="好租 Howzu">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<meta itemprop="name" content="${esc(t)}"><meta itemprop="image" content="${esc(img)}"><meta itemprop="description" content="${esc(d)}">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0f6b4f">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#1d2321;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit}.top{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;max-width:880px;margin:0 auto}
.logo{font-weight:700;text-decoration:none;color:#0f6b4f;letter-spacing:.02em}.top a.all{font-size:14px;color:#6b726f;text-decoration:none}
main{max-width:880px;margin:0 auto;padding:0 20px 120px}
.hero{position:relative;border-radius:16px;overflow:hidden;background:#eee;aspect-ratio:4/3}.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hero .n{position:absolute;right:12px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;font-size:13px;padding:4px 10px;border-radius:99px;text-decoration:none}
.let{position:absolute;left:12px;top:12px;background:#1d2321;color:#fff;font-size:13px;padding:4px 10px;border-radius:99px}
.price{font-size:28px;font-weight:700;margin:20px 0 2px;letter-spacing:-.01em}.price small{font-size:15px;font-weight:500;color:#6b726f}
h1{font-size:19px;font-weight:600;margin:0 0 4px}.addr{color:#6b726f;font-size:14px}
.facts{display:flex;gap:18px;margin:14px 0;font-size:15px;color:#1d2321}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.chips span{background:#e8f3ee;color:#0f6b4f;font-size:13px;padding:4px 10px;border-radius:99px}
.kf{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #ece9e2;border-radius:12px;margin:0 0 16px}.kf div{padding:10px 4px;text-align:center;min-width:0}.kf div+div{border-left:1px solid #ece9e2}.kf small{display:block;font-size:12px;color:#6b726f}.kf b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kf b.m{color:#9aa09d;font-weight:500}
.desc{white-space:pre-line;font-size:15px;border-top:1px solid #ece9e2;padding-top:18px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:22px 0}.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block}
.more{display:block;text-align:center;padding:14px;border:1px solid #e4e1d8;border-radius:12px;text-decoration:none;font-size:15px;margin-top:8px}
.trust{font-size:13px;color:#6b726f;margin-top:22px}
.bar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-top:1px solid #ece9e2;padding:12px 16px calc(12px + env(safe-area-inset-bottom))}
.bar div{max-width:880px;margin:0 auto;display:flex;gap:10px}
.bar a{flex:1;text-align:center;padding:13px 0;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;background:#0f6b4f;color:#fff}
.bar a.g{background:#fff;color:#0f6b4f;border:1px solid #0f6b4f}
@media(min-width:700px){.grid{grid-template-columns:repeat(3,1fr)}.hero{aspect-ratio:16/9}}
</style>
</head>
<body>
<header class="top"><a class="logo" href="../rentals.html">好租 Howzu</a><a class="all" href="../rentals.html">全部房源 ›</a></header>
<main>
<div class="hero">${P.length ? `<a href="${esc(full)}"><img src="${esc(rel(P[0]))}" alt="${esc(x.title)}"></a>` : ""}${isLet(x) ? '<span class="let">已租出</span>' : ""}${P.length > 1 ? `<a class="n" href="${esc(full)}">共 ${P.length} 张照片</a>` : ""}</div>
<div class="price">${isLet(x) ? "已租出" : x.rentWeekly ? `$${esc(x.rentWeekly)}<small> / 周</small>` : "<small>租金请咨询</small>"}</div>
<h1>${esc(x.title)}</h1>
<div class="addr">📍 ${esc(hideUnit(x.address))}</div>
${tags.length ? `<div class="facts">${tags.map(esc).join("<span></span>")}</div>` : ""}
<div class="kf">${kf.cells.map(([k, v]) => `<div><small>${esc(k)}</small><b${v === "咨询" ? ' class="m"' : ""}>${esc(v)}</b></div>`).join("")}</div>
${chips.length ? `<div class="chips">${chips.map(c => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
${x.desc ? `<div class="desc">${esc(x.desc)}</div>` : ""}
${P.length > 1 ? `<div class="grid">${P.slice(1, 7).map(p => `<a href="${esc(full)}"><img src="${esc(rel(p))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}
<a class="more" href="${esc(full)}">查看全部照片 · 看对口学区 ›</a>
<a class="more" href="../rentals.html">${isLet(x) ? "这套已租出，看看其他在租房源 ›" : "看看其他在租房源 ›"}</a>
<p class="trust">好租 Howzu · 持牌物业管理 · 全程中文服务</p>
</main>
${isLet(x) || !tel ? "" : `<nav class="bar"><div><a class="g" href="sms:${esc(tel)}?&amp;body=${msg}">💬 发短信</a><a href="tel:${esc(tel)}">📞 打电话 ${esc(fmtTel(tel))}</a></div></nav>`}
${!isLet(x) && !tel && wx ? `<nav class="bar"><div><a href="${esc(full)}">微信咨询：${esc(wx)}</a></div></nav>` : ""}
</body>
</html>
`;
  }

  const STATIC = [
    ["https://howzu.com.au/", "monthly", "1.0"],
    ["https://howzu.com.au/rentals.html", "daily", "0.9"],
    ["https://howzu.com.au/invest.html", "monthly", "0.8"],
    ["https://howzu.com.au/post.html", "monthly", "0.6"],
  ];
  function sitemap(listings) {
    const rows = STATIC.map(([u, f, p]) => `  <url><loc>${u}</loc><changefreq>${f}</changefreq><priority>${p}</priority></url>`);
    for (const x of listings) if (x.status === "live") rows.push(`  <url><loc>${esc(pageUrl(x))}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
  }
  const safeId = id => /^[\w-]+$/.test(String(id || ""));

  const api = { keyFacts, render, sitemap, ogTitle, ogDesc, ogImage, pageUrl, hideUnit, safeId };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ListingPage = api;
})(this);
