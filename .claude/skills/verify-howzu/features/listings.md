# 房源周租一致

在租房源（data/listings.json 里 status = live）的固定周租，在首页卡片、租房列表、房源页三处必须一样。维州出租广告必须写固定租金（s30F），所以每套都必须有 rentWeekly。

## Sub-features

- 首页“正在招租”卡片
- rentals.html 列表卡片
- rent/<id>.html 静态房源页（由 tools/build-listing-pages.js 生成）
- 房源页底部“📅 预约看房”按钮

## How to get to it (user POV)

- 打开首页，看“正在招租”。
- 点“🏠 在租房源”进列表。
- 点任意一套进房源页。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run listings`

- 读 /data/listings.json，取 status = live 的房源。
- 首页和列表：找 href 含房源 id、文字里有 `$数字` 的链接，文字必须含 `$<rentWeekly>`。
- 房源页：返回 200，正文含 `$<rentWeekly>`，有“📅 预约看房”链接。

## Gotchas

- 改了 listings.json 的租金，要重新生成 rent/*.html，否则房源页和列表对不上。这个流程就是为了抓这种情况。
- 已出租（let）和草稿（draft）不检查。
