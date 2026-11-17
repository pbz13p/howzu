# 房东托管留资

房东在房东卡片点“想找人托管”，留微信或手机，提交后存为“房东托管咨询”，来源“租金查询-房东”，后台询盘能单独筛出来。

## Sub-features

- 展开表单、自动聚焦
- 提交后显示“✅ 收到了”
- 防机器人隐藏字段 website

## How to get to it (user POV)

1. rents.html 底部房东卡片，点“想找人托管”。
2. 填微信号或手机，点提交。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run owner`

- 填 0400 000 000，提交。写库请求被拦下，存进 提交内容.json。
- 检查：kind = 房东托管咨询，内容含“租金查询-房东”，status = pending（公众看不到），页面出现“收到了”。

## Gotchas

- 拦下的请求返回 201，页面会以为成功；所以“收到了”只证明前端流程，真正入库靠线上数据库权限（不在本工具范围）。
