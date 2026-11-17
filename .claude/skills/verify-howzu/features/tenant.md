# 租客留需求

租客在租房列表底部“没找到合适的？”填想住的区、预算、房型、入住时间和联系方式，存为“求租需求”，有新房时通知。

## Sub-features

- 区：输入框 + 下拉建议（datalist）
- 预算、房型、入住时间按钮
- 联系方式（微信、手机或邮箱）

## How to get to it (user POV)

1. rentals.html 滚到底，或点“没找到合适的？留下需求”。
2. 填区、预算，点房型和时间，填联系方式。
3. 点“有新房通知我”。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run tenant`

- 填 Carlton、650、2 房、越快越好、0400 000 000。
- 检查：kind = 求租需求，内容含 650 和 Carlton，status = pending。

## Gotchas

- “想住哪里”不是下拉框，是带建议的输入框，要用 fill，不要用 selectOption。
