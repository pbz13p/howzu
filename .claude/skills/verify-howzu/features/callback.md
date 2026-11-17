# 联系我们 · 回电

全站右下角“💬 联系我们”：一键电话、短信，或留电话、微信等回电。存为“回电请求”，话题按页面自动选（房源页是“租房”，查租金和发房源页是“我是房东”）。

## Sub-features

- 打电话、发短信
- 话题按钮（租房、我是房东、买房、其他）
- 留电话或微信，称呼可不填

## How to get to it (user POV)

1. 任意页面右下角点“💬 联系我们”。
2. 填电话或微信，点“请回电给我”。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run callback`

- 在第一套在租房源页操作，填 0400 000 000。
- 检查：kind = 回电请求，highlights 含“租房”，contact_phone 是填的号码，页面出现“收到了”。

## Gotchas

- 房源页底部有固定按钮条，联系按钮会自动往上挪，避免挡住。截图里看位置。
