# 生成 guide/area-*.html 区域租房页：python3 tools/area_pages.py
import json,os,sys,html,math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import guide_gen as gen
def _inside(lng,lat,ring):
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
            if _inside(x["lng"],x["lat"],p[0]) and not any(_inside(x["lng"],x["lat"],h) for h in p[1:]): return True
    return False
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=json.load(open(f"{R}/data/schools.json"));by={x["no"]:x for x in S}
ZP=json.load(open(f"{R}/data/zones_primary.json"))["features"];ZS=json.load(open(f"{R}/data/zones_secondary.json"))["features"]
L=json.load(open(f"{R}/data/listings.json"))["listings"]
UNIS=[("墨尔本大学（Parkville）",-37.7963,144.9614),("RMIT（城市校区）",-37.8083,144.9631),("莫纳什大学 Caulfield",-37.8770,145.0443),("莫纳什大学 Clayton",-37.9105,145.1362),("迪肯大学 Burwood",-37.8475,145.1149)]
AREAS=[
 dict(slug="area-melbourne-cbd",name="墨尔本 CBD",en="Melbourne CBD",sub="Melbourne CBD",lat=-37.8136,lng=144.9631,ftz="在免费电车区内：只在 CBD 和 Docklands 范围里坐电车不用刷 myki。"),
 dict(slug="area-southbank",name="Southbank",en="Southbank",sub="Southbank",lat=-37.8226,lng=144.9646,ftz="不在免费电车区内（免费区南边界是 Flinders St），过河进城坐电车要刷 myki；步行过桥到 Flinders Street 车站一般十几分钟。"),
 dict(slug="area-docklands",name="Docklands",en="Docklands",sub="Docklands",lat=-37.8160,lng=144.9460,ftz="大部分在免费电车区内：在 Docklands 和 CBD 之间坐电车不用刷 myki。"),
 dict(slug="area-carlton",name="Carlton",en="Carlton",sub="Carlton",lat=-37.8001,lng=144.9671,ftz="不在免费电车区内（免费区北边界在 Victoria St 一带），往南进城坐电车要刷 myki；步行到 CBD 北部一般十几分钟。"),
]
def km(a,b,c,d):
    r=6371;p=math.pi/180;x=(d-b)*p*math.cos((a+c)/2*p);y=(c-a)*p;return r*math.hypot(x,y)
def zones_at(F,lat,lng):
    pt={"lat":lat,"lng":lng};out=[]
    for f in F:
        if inzone(pt,[f]): out.append(f["properties"])
    return out
for A in AREAS:
    pz=zones_at(ZP,A["lat"],A["lng"]);sz=zones_at(ZS,A["lat"],A["lng"])
    def zl(z):
        s=by.get(z["no"]);extra=f"（2025 VCE 中位分 {s['vce_med']:.0f}）" if s and s.get("vce_med") else ""
        return html.escape(z["name"])+extra
    live=[x for x in L if x["suburb"]==A["sub"] and x["status"]=="live"];let=[x for x in L if x["suburb"]==A["sub"] and x["status"]=="let"]
    uni="".join(f"<tr><td>{n}</td><td>约 {km(A['lat'],A['lng'],a,b):.1f} 公里</td></tr>" for n,a,b in UNIS)
    zg=json.load(open(f"{R}/data/zone_guides.json"))
    szl="、".join((f'<a href="/guide/{zg[str(z["no"])]}.html">{zl(z)}</a>' if str(z["no"]) in zg else zl(z)) for z in sz) or "（中心点不在任何公立中学学区内，按具体地址查）"
    pzl="、".join(zl(z) for z in pz) or "（按具体地址查）"
    lst="".join(f'<li><a href="/rentals.html?id={x["id"]}">{html.escape(x["title"])}</a></li>' for x in live)
    sm=[f"{A['ftz']}",
        f"到墨尔本大学约 <b>{km(A['lat'],A['lng'],UNIS[0][1],UNIS[0][2]):.1f} 公里</b>、到 RMIT 约 <b>{km(A['lat'],A['lng'],UNIS[1][1],UNIS[1][2]):.1f} 公里</b>（直线距离）。",
        f"区中心点对口的公立中学学区：{szl}。不同街道可能不同，签约前按具体地址查。",
        "租房押金一律交政府 RTBA 托管；申请租房不用付任何申请费。",
        f"好租在 {html.escape(A['name'])} 的在租房源见下方（实时更新）；没有合适的可以留下需求，有新房第一时间通知你。"]
    body=f'''<h2>到各大学有多远（直线距离）</h2>
<div class="ex"><table>{uni}</table></div>
<p class="meta">按区中心点的直线距离估算，实际路程和时间以地图为准。每套房源详情页有按地址估算的通勤时间。</p>
<h2>对口公立学校（区中心点）</h2>
<ul class="dot"><li>中学：{szl}</li><li>小学：{pzl}</li></ul>
<p>学区按具体地址划分，同一个区不同街道可能对口不同学校。用 <a href="/">好租查学区</a> 输入地址查，签约前再到 Find my School 核对。按学区租房的注意事项见 <a href="/guide/school-zone.html">按学区租房</a>。</p>
<h2>好租在 {html.escape(A['name'])} 的房源</h2>
<ul class="dot" id="areaL"><li>加载中…</li></ul>
<script>fetch("/data/listings.json").then(r=>r.json()).then(j=>{{const L=(j.listings||[]).filter(x=>x.suburb==={json.dumps(A['sub'])}&&x.status==="live");const e=s=>String(s).replace(/[&<>"]/g,c=>({{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}})[c]);document.getElementById("areaL").innerHTML=L.length?L.map(x=>`<li><a href="/rentals.html?id=${{encodeURIComponent(x.id)}}">${{e(x.title)}}</a></li>`).join(""):"<li>暂时没有在租房源，可以留下需求。</li>";}}).catch(()=>{{document.getElementById("areaL").innerHTML='<li><a href="/rentals.html">看全部在租房源</a></li>'}});</script>
<p><a href="/rentals.html">看全部在租房源 ›</a> · <a href="/rentals.html#leadCard">留下需求，有新房通知你 ›</a></p>
<h2>在这里租房前，先看这几篇</h2>
<ul class="dot"><li><a href="/guide/first-rental.html">留学生第一次在墨尔本租房</a></li><li><a href="/guide/apply.html">租房申请新规：哪些钱不该付</a></li><li><a href="/guide/bond.html">押金怎么交、怎么退</a></li><li><a href="/guide/utilities.html">水电煤网谁付</a></li><li><a href="/guide/sublet.html">找二房东租房间安全吗</a></li></ul>'''
    title=f"{A['name']} 租房指南：免费电车区、到大学距离、对口学区和在租房源"
    desc=f"在墨尔本 {A['en']} 租房：{A['ftz'][:30]}… 到墨尔本大学、RMIT、莫纳什的直线距离，区中心点对口的公立学校学区，以及好租在该区的在租房源。"
    gen.build(dict(slug=A["slug"],section="rental",kick="区域",org="PTV 和维州教育部 ",title=title,desc=desc,sum=sm,body=body,
      disc="本文只是通俗说明，不构成法律或租房建议。距离为直线估算，学区按区中心点计算，仅供参考，以 PTV、Find my School 和官方网站为准。",
      sources=[("PTV · Free Tram Zone（免费电车区范围）","https://www.ptv.vic.gov.au/getting-around/visiting-melbourne"),("Find my School（维州官方学区查询）","https://www.findmyschool.vic.gov.au"),("DataVic · Victorian Government School Zones 2027","https://discover.data.vic.gov.au/dataset/victorian-government-school-zones-2027")]))
    print(A["slug"],len(sz),len(pz),len(live))
