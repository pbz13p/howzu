# 英文界面

导航栏 EN 按钮或网址加 ?lang=en 切英文，选过会记住，换页仍是英文。

## Sub-features

- 首页、租房列表和详情、房源页、发房源页、房东确认页、404

## How to get to it (user POV)

- 点导航栏 EN，或打开带 ?lang=en 的链接。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run english`

- 打开 rentals.html?lang=en，一级标题不能有中文；再打开 index.html（不带参数），一级标题仍不能有中文。

## Gotchas

- 128 篇指南文章还没有英文，不检查。
