# 生成 guide/zone-*.html 学区租房页：python3 tools/zone_pages.py（学区或 VCE 数据更新后重跑，再跑 node tools/build-listing-pages.js 更新 sitemap）
# 注意：增删学校后，guide/property.html 里“热门公立中学学区”的小卡片和 guide/school-zone.html 的链接列表要同步更新
import json,re,sys,html,urllib.parse
import os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import guide_gen as gen
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=json.load(open(f"{R}/data/schools.json"));Z=json.load(open(f"{R}/data/zones_secondary.json"))["features"]
zn={}
for f in Z: zn.setdefault(f["properties"]["no"],[]).append(f)
PICK=["Balwyn High School","Glen Waverley Secondary College","McKinnon Secondary College","Box Hill High School","East Doncaster Secondary College","Koonung Secondary College","Doncaster Secondary College","Williamstown High School","Ashwood High School","Princes Hill Secondary College","Vermont Secondary College","Auburn High School","Kew High School","Blackburn High School","Highvale Secondary College","University High School","Northcote High School","Brighton Secondary College","Canterbury Girls Secondary College","Melbourne Girls College","Forest Hill College","Sandringham College","Camberwell High School","Mount Waverley Secondary College","Brentwood Secondary College","Albert Park College","Glen Eira College","Bentleigh Secondary College","Wellington Secondary College","Templestowe College","Ringwood Secondary College","Mordialloc College","Mentone Girls Secondary College","Viewbank College","Beaumaris Secondary College","Richmond High School","Brunswick Secondary College","Strathmore Secondary College"]
by={x["name"]:x for x in S}
def rings(f):
    g=f["geometry"];return g["coordinates"] if g["type"]=="Polygon" else [r for p in g["coordinates"] for r in p]
def inside(lng,lat,ring):
    c=False;n=len(ring);j=n-1
    for i in range(n):
        xi,yi=ring[i];xj,yj=ring[j]
        if (yi>lat)!=(yj>lat) and lng<(xj-xi)*(lat-yi)/(yj-yi+1e-15)+xi: c=not c
        j=i
    return c
def inzone(x,fs):
    for f in fs:
        g=f["geometry"];polys=[g["coordinates"]] if g["type"]=="Polygon" else g["coordinates"]
        for p in polys:
            if inside(x["lng"],x["lat"],p[0]) and not any(inside(x["lng"],x["lat"],h) for h in p[1:]): return True
    return False
def suburb(a):
    a=re.sub(r"(,\s*)Mt\.? ",r"\1Mount ",a,flags=re.I)
    m=re.search(r",\s*([^,]+?)\s+\d{4}$",a);return re.sub(r"\bMc(\w)",lambda k:"Mc"+k.group(1).upper(),m.group(1).title()) if m else ""
def slug(n): return "zone-"+re.sub(r"[^a-z0-9]+","-",n.lower()).strip("-")
out=[]
total=453
for name in PICK:
    x=by[name];fs=zn[x["no"]]
    inn=[y for y in S if y.get("lat") and inzone(y,fs)]
    subs=sorted({suburb(y["addr"]) for y in inn if suburb(y["addr"])})
    prim=sorted([y for y in inn if y["sector"]=="Government" and y["type"]=="Primary"],key=lambda y:y["name"])
    geo=[[[round(c[0],5),round(c[1],5)] for c in r] for f in fs for r in rings(f)]
    girls="Girls" in name
    yl=fs[0]["properties"]["yl"]
    sl=slug(name)
    title=f"{name} 学区租房指南：2025 VCE 中位分 {x['vce_med']:.0f}、学区范围和入学要点"
    desc=f"{name}（{suburb(x['addr'])}）2025 年 VCE 中位分 {x['vce_med']:.0f}，40 分以上比例 {x['vce_p40']}%，在 {total} 所公布成绩的学校中排第 {x['vce_rank']}。附 2027 学区地图、学区内的区和公立小学，以及按学区租房要注意的事。"
    sm=[f"<b>{html.escape(name)}</b> 是公立中学，地址 {html.escape(x['addr'])}。",
        f"2025 年 VCE 中位分 <b>{x['vce_med']:.0f}</b>，40 分以上占 <b>{x['vce_p40']}%</b>，在 {total} 所公布成绩的学校里排第 <b>{x['vce_rank']}</b>（好租按 VCAA 公布的中位分排序，同分看 40 分以上比例）。",
        ("女校：学区只对女生适用。" if girls else f"住在学区内（2027 学区，适用年级：{html.escape(yl)}），孩子<b>保证有学位</b>。"),
        "租房也算数：只要真的住在学区内的地址，租约就能用来报名；租期要覆盖开学第一天。",
        "学区边界会调整，签约前一定用 Find my School 按<b>具体地址</b>核对。"]
    subl="、".join(subs) if subs else "（见地图）"
    pl="".join(f"<li>{html.escape(p['name'])}<span style='color:#8a908d'> · {html.escape(suburb(p['addr']))}</span></li>" for p in prim[:15])
    body=f'''<h2>学区地图（2027）</h2>
<div id="zmap" style="height:360px;border-radius:16px;overflow:hidden;background:#eef2f0;margin:8px 0"></div>
<p class="meta" style="margin:6px 0 0">绿色区域为 {html.escape(name)} 的 2027 学区，红点是学校位置。地图仅供参考，以 Find my School 为准。</p>
<h2>学区里有哪些区？</h2>
<p>按学区内的学校地址统计，学区覆盖（全部或部分）：<b>{html.escape(subl)}</b>。同一个区可能只有一部分在学区里，一定按具体地址查。</p>
{f"<h2>学区内的公立小学</h2><ul class='dot'>{pl}</ul><p>小学有自己的学区，和中学学区不一样，要分别查。</p>" if pl else ""}
<h2>在这个学区租房，要注意</h2>
<ol class="steps">
<li><b>先核对地址</b>：用 <a href="/">好租查学区</a> 输入地址看附近学校，再到 Find my School 核对确实在学区内。</li>
<li><b>报名的家长写进租约</b>：学校会核对住址证明上的名字和地址。</li>
<li><b>租期覆盖开学第一天</b>：快到期就提前续签。</li>
<li><b>真的住进去</b>：只挂地址不住，录取可能被撤回。详见 <a href="/guide/school-zone.html">按学区租房：租约能不能报名</a>。</li>
</ol>
<p><a href="/rentals.html?zone={urllib.parse.quote(name)}">在地图上看 {html.escape(name)} 学区里的好租在租房源 ›</a></p>
<div class="note">热门学区的房子往往一出来就被租走。可以在好租<a href="/rentals.html#leadCard">留下需求</a>，写上 {html.escape(name)} 学区，有合适的房源第一时间通知你。</div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
<script>
window.addEventListener("load",function(){{try{{var G={json.dumps(geo)};var m=L.map("zmap",{{scrollWheelZoom:false}});L.tileLayer("https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png",{{maxZoom:18,attribution:"&copy; OpenStreetMap"}}).addTo(m);var p=L.polygon(G.map(function(r){{return r.map(function(c){{return [c[1],c[0]]}})}}),{{color:"#0f6b4f",weight:2,fillOpacity:.15}}).addTo(m);L.circleMarker([{x['lat']},{x['lng']}],{{radius:7,color:"#c2410c",fillColor:"#c2410c",fillOpacity:1}}).addTo(m).bindPopup({json.dumps(name)});m.fitBounds(p.getBounds(),{{padding:[10,10]}});}}catch(e){{console.log("zmap",e&&e.message);document.getElementById("zmap").textContent="地图加载失败，请到 Find my School 查看学区。"}}}});
</script>'''
    A=dict(slug=sl,section="rental",kick="学区",org="维州教育部 Find my School 和 VCAA ",title=title,desc=desc,sum=sm,body=body,
      disc="本文只是通俗说明，不构成法律或教育建议。学区、入学政策和成绩每年可能变化，以 Find my School、学校和维州教育部官网为准。VCE 数据来自 VCAA 公布的 2025 年学校成绩。",
      cta='<section class="cta">\n<h3>想在好学区附近租房？</h3>\n<p>好租房源全程中文、持牌管理、押金交政府 RTBA 托管、租客零中介费，自管房源用维州标准租约，方便报名。</p>\n<div class="b"><a href="/rentals.html">看在租房源</a><a class="g" href="/rentals.html#leadCard">留下需求，有房通知你</a></div>\n</section>',
      sources=[("Find my School（维州官方学区查询）","https://www.findmyschool.vic.gov.au"),("DataVic · Victorian Government School Zones 2027","https://discover.data.vic.gov.au/dataset/victorian-government-school-zones-2027"),("VCAA · 2025 Senior Secondary Completion and Achievement Information","https://www.vcaa.vic.edu.au/sites/default/files/2025-12/2025-SeniorSecondaryCompletionandAchievementInformation.xlsx")])
    gen.build(A);out.append((sl,name,x,subs))
json.dump([(a,b,c["vce_med"],c["vce_rank"],suburb(c["addr"])) for a,b,c,d in out],open(os.path.join(R,"tools","zone_pages.json"),"w"))
json.dump({str(c["no"]):a for a,b,c,d in out},open(os.path.join(R,"data","zone_guides.json"),"w"),separators=(",",":"))
print(len(out))
