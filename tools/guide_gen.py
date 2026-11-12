# 文章页生成器：A=dict(slug,title,desc,sum,body,sources...) → guide/<slug>.html，样式沿用 guide/negative-gearing.html
import json,re,sys,html
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tpl=open(f"{ROOT}/guide/negative-gearing.html",encoding="utf8").read()
style=tpl[tpl.index("<style>"):tpl.index("</style>")+8]
def build(a):
    slug,title,desc,kick,section=a["slug"],a["title"],a["desc"],a["kick"],a["section"]
    url=f"https://howzu.com.au/guide/{slug}.html"
    ld=json.dumps({"@context":"https://schema.org","@type":"Article","headline":title,"inLanguage":"zh-CN","datePublished":"2026-11-12","dateModified":"2026-11-12","author":{"@type":"Organization","name":"好租 Howzu"},"publisher":{"@type":"Organization","name":"好租 Howzu"},"mainEntityOfPage":url},ensure_ascii=False)
    e=html.escape
    back = '<a class="all" href="/guide/property.html">房产干货 ›</a>' if section=="property" else '<a class="all" href="/guide/property.html">全部指南 ›</a>'
    src="".join(f'<li>{e(n)}：<a href="{u}">{e(u.replace("https://",""))}</a></li>' for n,u in a["sources"])
    disc = a.get("disc","本文只是通俗说明，不构成税务、法律或财务建议。每个人情况不同，具体请咨询注册税务师（Registered Tax Agent），并以官方网站为准。")
    cta = a.get("cta") or ('<section class="cta">\n<h3>在墨尔本有房出租？</h3>\n<p>好租 / 胜腾 Cendant 持牌管理：全程中文、押金交政府 RTBA 托管、账单代付、每月对账。</p>\n<div class="b"><a href="/rentals.html">看在租房源</a><a class="g" href="/post.html">免费发布房源</a></div>\n</section>' if section=="property" else '<section class="cta">\n<h3>在墨尔本找房？</h3>\n<p>好租房源全程中文、持牌管理、押金交政府 RTBA 托管、租客零中介费。</p>\n<div class="b"><a href="/rentals.html">看在租房源</a><a class="g" href="/rentals.html#leadCard">留下需求，有房通知你</a></div>\n</section>')
    sums="".join(f"<li>{s}</li>" for s in a["sum"])
    out=f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | 好租 Howzu {"房产干货" if section=="property" else "租房指南"}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="好租 Howzu">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://howzu.com.au/photos/3005-latrobe-1.jpg">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#0f6b4f">
<script type="application/ld+json">{ld}</script>
{style}
</head>
<body>
<header class="top"><a class="logo" href="/">好租 Howzu</a>{back}</header>
<main>
<div class="kick">{"房产干货" if section=="property" else "租房指南"} · {e(kick)}</div>
<h1>{e(title)}</h1>
<p class="meta">好租 Howzu 整理 · 2026 年 11 月 12 日更新 · 规则来自{e(a["org"])}官网，见文末来源</p>
<section class="sum">
<h2>30 秒看懂</h2>
<ol>
{sums}
</ol>
</section>
{a["body"]}
{cta}
<section class="src">
<h2>官方来源（2026 年 11 月查阅）</h2>
<ul>
{src}
</ul>
<p>{disc}</p>
</section>
</main>
<script src="/js/config.js?v=20261107"></script><script src="/js/track.js?v=20261113" defer></script>
</body>
</html>
'''
    open(f"{ROOT}/guide/{slug}.html","w",encoding="utf8").write(out)
    return slug
if __name__=="__main__":
    import importlib.util
    for p in sys.argv[1:]:
        spec=importlib.util.spec_from_file_location("m",p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        print(build(m.A))
