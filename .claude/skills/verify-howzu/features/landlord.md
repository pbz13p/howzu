# 房东卡片：我的房能租多少？

房东在查租金页（也在 25 个区域页、投资测算页底部）选区和房型，看到政府公开的周租中位数，一键免费上架，发房源页已预填区、几房、房型、周租。

## Sub-features

- 选区、选房型，显示“约 $X / 周”、套数、截至日期、来源 DFFH
- 没有样本时提示换房型
- “免费上架到好租”带参数跳 post.html?suburb=&beds=&ptype=&rent=&from=rents
- “想找人托管”见 owner.md

## How to get to it (user POV)

1. 打开 rents.html，滚到底部“🔑 我是房东：我的房能租多少？”。
2. 选区、选房型。
3. 点“免费上架到好租”。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run landlord`

- 选 Box Hill、2 房公寓。
- 结果必须有“约 $数字 / 周”、“截至”、“DFFH”，不能出现租金区间（公开数据只有中位数）。
- 跳转网址带 suburb 和 rent；发房源页周租框 = 卡片上的数字。
- 点击次数 ≤ 3。

## Gotchas

- 发房源页的脚本从 esm.sh 加载 Supabase 库。运行环境连不上 esm.sh 时，预填检查记为“没验证”，用 --live 或每日巡检确认。
