# 生成新闻页：python3 tools/news_gen.py  → news/YYYY-MM-DD.html、news/index.html（最新一期 + 往期）、首页“今日墨尔本”
import json, glob, os, re, html
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); e = html.escape
CATS = [("墨尔本", "🏙️ 墨尔本 · 维州"), ("地产", "🏠 地产 · 租房"), ("移民", "🛂 移民 · 留学"), ("中澳", "🇨🇳 中澳"), ("生活", "☕ 澳洲生活")]
issues = sorted(glob.glob(f"{R}/data/news/20??-??-??.json"), reverse=True)
import urllib.parse
def zhlink(x):
    # 英文新闻：点标题直接打开 Google 翻译成中文的原文页（翻译由 Google 现场完成，我们只放链接）
    if re.search(r"[\u4e00-\u9fff]", x.get("src","")+x["link"]) and ("sbs.com.au/language/chinese" in x["link"]): return x["link"]
    if x["link"].startswith("http") and not re.search(r"\.gov\.au/.*\.pdf$", x["link"]):
        return "https://translate.google.com/translate?sl=auto&tl=zh-CN&u=" + urllib.parse.quote(x["link"], safe="")
    return x["link"]
def zh(d): y, m, dd = d.split("-"); return f"{y} 年 {int(m)} 月 {int(dd)} 日"
def page(d, items, canon, archive):
    side = SIDE
    cols3 = [[], [], []]; load = [0, 0, 0]
    for c, label in CATS:
        xs = [x for x in items if x["cat"] == c]
        if not xs: continue
        i = load.index(min(load)); load[i] += len(xs) + 2; cols3[i].append((c, label, xs))
    blocks = ""
    for col in cols3:
      blocks += '<div class="col">'
      for c, label, xs in col:
        blocks += f'<section class="nc" id="{c}"><h2>{label}<small>{len(xs)} 条</small></h2><ol>' + "".join(
            f'<li><a href="{e(zhlink(x))}" target="_blank" rel="noopener nofollow">{e(x["t"])}</a><p>{e(x["s"])}</p><span>{e(x["src"])}</span>{"" if zhlink(x)==x["link"] else f' · <a class="en" href="{e(x["link"])}" target="_blank" rel="noopener nofollow">英文原文</a>'}</li>' for x in xs) + "</ol></section>"
      blocks += "</div>"
    jump = "".join(f'<a href="#{c}">{l.split(" ",1)[1]}</a>' for c, l in CATS if any(x["cat"] == c for x in items))
    arch = "".join(f'<a href="/news/{a}.html">{zh(a)}</a>' for a in archive[:30])
    title = f"墨尔本今日要闻 {zh(d)} | 澳洲生活、移民、地产新闻 | 好租 Howzu"
    desc = "每天约 40 条：墨尔本和维州、地产租房、移民留学、中澳、澳洲生活。中文标题加一句话摘要，点进去看原文。" 
    bc = json.dumps({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "好租 Howzu", "item": "https://howzu.com.au/"}, {"@type": "ListItem", "position": 2, "name": "今日要闻", "item": "https://howzu.com.au/news/"}, {"@type": "ListItem", "position": 3, "name": zh(d), "item": f"https://howzu.com.au/news/{d}.html"}]}, ensure_ascii=False)
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{canon}">
<link rel="icon" href="/favicon.svg"><meta name="theme-color" content="#0f6b4f"><script type="application/ld+json">{bc}</script>
<style>body{{margin:0;font:16px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1d2b26;background:#f7f6f2}}main{{max-width:1280px;margin:0 auto;padding:12px 18px 90px}}.wrap{{display:grid;gap:20px}}.cols{{display:grid;gap:14px}}.col{{min-width:0}}.nc{{break-inside:avoid}}aside .box{{background:#fff;border:1px solid #e6ece9;border-radius:12px;padding:10px 14px;margin:12px 0}}aside h3{{font-size:16px;margin:6px 0}}aside ul{{list-style:none;margin:0;padding:0}}aside li{{padding:7px 0;border-top:1px solid #f0f0f0;font-size:14px}}aside li a{{color:#1d2b26;text-decoration:none;font-weight:600}}aside li small{{display:block;color:#0f6b4f;font-weight:400}}@media(min-width:1100px){{main{{max-width:none;padding:12px 24px 90px}}.wrap{{grid-template-columns:minmax(0,1fr) 270px}}.cols{{grid-template-columns:repeat(3,minmax(0,1fr))}}h1{{font-size:26px}}}}
header{{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border-bottom:1px solid #e6ece9}}header a.logo{{white-space:nowrap;flex:none;font-weight:700;color:#0f6b4f;text-decoration:none;font-size:18px}}header a.r{{margin-left:auto;color:#0f6b4f;font-size:14px}}
h1{{font-size:22px;margin:14px 0 4px}}.meta{{color:#666;font-size:13px;margin:0 0 10px}}.jump{{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 6px;position:sticky;top:0;background:#f7f6f2;padding:6px 0;z-index:5}}.jump a{{border:1px solid #cfe3da;background:#fff;border-radius:16px;padding:4px 11px;font-size:14px;color:#0f6b4f;text-decoration:none}}
.nc{{background:#fff;border:1px solid #e6ece9;border-radius:12px;padding:6px 14px;margin:0 0 14px}}aside .box:first-child{{margin-top:0}}.nc h2{{font-size:17px;margin:8px 0}}.nc h2 small{{font-weight:400;color:#888;font-size:12px;margin-left:6px}}.nc ol{{margin:0;padding:0;list-style:none}}
.nc li{{padding:9px 0;border-top:1px solid #f0f0f0}}.nc li a{{color:#1d2b26;font-weight:600;text-decoration:none}}.nc li a:active,.nc li a:hover{{color:#0f6b4f}}.nc li p{{margin:3px 0 0;color:#555;font-size:14px}}.nc li span{{font-size:12px;color:#0f6b4f}}.nc li a.en{{font-size:12px;font-weight:400;color:#888}}
.arch{{display:flex;flex-wrap:wrap;gap:6px}}.arch a{{font-size:13px;color:#0f6b4f}}aside .box.cta,.cta{{background:#0f6b4f;color:#fff;border-color:#0f6b4f;line-height:2}}nav.top{{display:flex;gap:4px;overflow-x:auto;margin-left:10px}}nav.top a{{white-space:nowrap;padding:6px 10px;border-radius:8px;color:#1d2b26;text-decoration:none;font-size:15px}}nav.top a.on{{background:#e8f3ee;color:#0f6b4f;font-weight:600}}.cta a{{color:#fff;font-weight:700}}.note{{font-size:12px;color:#888}}</style></head><body>
<header><a class="logo" href="/">好租 Howzu</a><nav class="top"><a href="/news/" class="on">📰 今日要闻</a><a href="/rentals.html">🏠 在租房源</a><a href="/sale/">🏡 在售</a><a href="/invest.html">📈 投资</a><a href="/guide/fx.html">💱 换汇</a><a href="/guide/property.html">📚 干货</a><a href="/">🏫 查学区</a></nav></header><main>
<h1>墨尔本今日要闻 · {zh(d)}</h1><p class="meta">{len(items)} 条 · 每天上午更新 · 中文标题和摘要由好租整理，点标题看中文全文（Google 翻译）</p>
<nav class="jump">{jump}</nav><div class="wrap"><div class="cols">{blocks}</div><aside>{side}<div class="box"><h3>往期要闻</h3><div class="arch">{arch}</div></div></aside></div>
<p class="note">新闻来自 ABC、SBS、卫报澳洲版、The Conversation、realestate.com.au 新闻、Cotality、维州政府等公开来源，版权归原媒体所有；本页只提供中文标题、一句话摘要和原文链接。</p>
</main><script src="/js/config.js" defer></script><script src="/js/track.js?v=20261114" defer></script><script src="/js/contact-fab.js?v=20261117" defer></script></body></html>'''
L = [x for x in json.load(open(f"{R}/data/listings.json"))["listings"] if x.get("status") == "live"][:6]
SIDE = '<div class="box"><h3>🏠 好租在租房源</h3><ul>' + "".join(f'<li><a href="/rent/{e(x["id"])}.html">{e(x["title"])}</a><small>{e(x.get("suburb",""))}{" · $"+str(x["rentWeekly"])+"/周" if x.get("rentWeekly") else ""}</small></li>' for x in L) + '</ul><p style="margin:8px 0 2px"><a href="/rentals.html" style="color:#0f6b4f;font-weight:700">看全部 ›</a></p></div>' + \
  '<div class="box cta" style="margin-top:12px">有房出租？<a href="/post.html">免费发房源 ›</a><br>想估租金？<a href="/rents.html">查租金 ›</a><br>留学生找房？<a href="/guide/study-abroad.html">开学季专区 ›</a></div>'
os.makedirs(f"{R}/news", exist_ok=True)
dates = [os.path.basename(f)[:10] for f in issues]
for f in issues:
    d = os.path.basename(f)[:10]; items = json.load(open(f))["items"]
    open(f"{R}/news/{d}.html", "w").write(page(d, items, f"https://howzu.com.au/news/{d}.html", dates))
if issues:
    d = dates[0]; items = json.load(open(issues[0]))["items"]
    open(f"{R}/news/index.html", "w").write(page(d, items, "https://howzu.com.au/news/", dates))
    # 首页“今日墨尔本”：墨尔本、地产、移民优先，取 6 条
    pick, by = [], {c: [x for x in items if x["cat"] == c] for c in ("墨尔本", "地产", "移民", "中澳", "生活")}
    while len(pick) < 6 and any(by.values()):
        for c in by:
            if by[c] and len(pick) < 6: pick.append(by[c].pop(0))
    li = "".join(f'<a class="hn-a" href="news/#{x["cat"]}"><span class="hn-k">{e(x["cat"])}</span><b>{e(x["t"])}</b></a>' for x in pick)
    p = f"{R}/index.html"; s = open(p).read()
    s = re.sub(r'<div class="hn-l" id="nwL">[\s\S]*?</div><!--/nwL-->', f'<div class="hn-l" id="nwL">{li}</div><!--/nwL-->', s)
    s = re.sub(r'<h2 id="nwH">[^<]*</h2>', f'<h2 id="nwH">今日要闻 · {int(d[5:7])}/{int(d[8:])}</h2>', s)
    open(p, "w").write(s)
print("新闻页：", len(issues), "期")
