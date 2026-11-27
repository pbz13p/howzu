# 中介房源怎么接进好租（REAXML）· 一页说明

2026-11-27 整理，全部来自公开资料（链接在每行后面）。

## 结论
- 澳洲中介系统给第三方网站推房源，通用格式是 **REAXML**（realestate.com.au 定的 XML）。Rex、VaultRE、Agentbox、Box+Dice、PropertyMe Grow 都能输出。
- **最常见的方式是“中介系统用 FTP 推文件到我们的服务器”**，不是“我们去一个网址拉”。所以：
  - 我们现在做好的是“给一个网址，定时去拉”（tools/import-feed.js），适合能给出导出网址的中介（或中介的网站插件、第三方汇总服务给的网址）。
  - 要接 FTP 推送，需要一台能收 FTP 的小服务器（便宜的云主机或 FTP 托管，每月约几块到十几块澳元）。这要花钱，写在「待 Frank 处理」，Frank 定了再做。
  - VaultRE 另有开放 API：中介在后台生成一个第三方令牌，我们直接用 API 拉，不需要 FTP、也不花钱。第一个 VaultRE 中介答应后再写这一段代码。
- 有的系统开第三方推送要收中介的钱（见下表），邀请时要问清楚，别让中介觉得被坑。

## 各系统怎么接、中介那边要做几步

| 系统 | 怎么接 | 中介要做的 | 费用（公开资料） | 来源 |
|---|---|---|---|---|
| Rex | 除了各大网站，Rex 也支持把 REAXML 推到其他接收端（小网站、自己的网站）；新的推送由“接收方”联系 Rex 开通；更新 15 分钟到 2 小时到 | 告诉 Rex 支持“要加好租为推送对象”，然后在每套房源的推送设置里勾上好租 | 未公开 | https://support.rexsoftware.com/hc/en-us/articles/360024684133-Introduction-to-Portals · https://support.rexsoftware.com/hc/en-us/articles/360055782714-Portals |
| VaultRE | 开放 REST API；中介在 Office Integrations → Third Party Access 给第三方生成令牌（Snug 就是这样接的） | 后台点 3 下生成令牌，发给我们 | 未公开 | https://help.snug.com/hc/en-us/articles/360001231915-VaultRE-Property-Feed-and-Viewings-Sync · https://apis.io/providers/vaultre/ |
| Agentbox | 把 REAXML 用 FTP 推到接收方的服务器 | 在 Agentbox 里加一个推送目的地（FTP 地址、账号） | 未公开 | https://klemich-docs.netlify.app/docs/backend/importing-properties · https://github.com/api-evangelist/agentbox |
| PropertyMe（Grow CRM） | 用 REAXML；把接收方的 FTP 地址、账号、密码、目录、端口发给 PropertyMe 客服，由客服开通 | 发一封邮件给 PropertyMe 客服 | 未公开 | https://crmsupport.propertyme.com/hc/en-au/articles/53762703651225 |
| MyDesktop | REAXML 每小时 FTP 推送；要先签一张开通申请表 | 签表 + 每套房源勾选推送 | 开通费 $220 + 月费 | https://codex.easypropertylistings.com.au/article/205-mydesktop-reaxml-feedsync-setup |
| Box+Dice（MRI） | 资料里只看到数据导出，第三方推送的做法待问 | 待问 | 待问 | https://boxdice.zendesk.com/hc/en-au/articles/12857456898191-Data-Export-Advanced-Export |
| Arosoftware（举例：有的系统要收费） | REAXML 推到接收方 FTP | 购买推送服务 | 开通 $440 + 每月 $22 | https://arohelp.arosoftware.com/portal/en/kb/articles/reaxml-property-data-feed |

## 我们怎么处理（已经做好）
- tools/import-feed.js：读 REAXML，只导 `<rental>`（住宅出租）、状态 current、写了纯数字固定租金的（维州出租广告必须写固定租金）；按月写的换算成周租；外州、出售、商业的不导。
- 中介下架、租出、撤回（leased / withdrawn / offmarket / deleted），或全量 feed 里不再出现的：下次运行改成“已租出”，页面保留、退出 sitemap。
- 照片直接用中介给的图片网址，不下载存储。
- 中介没有书面确认“符合维州最低租住标准（RTA s65B）”的，只进后台（pending），不公开。
- 名单在 data/feeds.json；每 2 小时由 .github/workflows/feeds.yml 跑，跑完触发房源页构建（静态页 + IndexNow）。
- 询盘照常进好租后台；中介打开转发后（feeds.json 里 forward: true），tools/forward-leads.js 自动转一份给中介，邮件里写“本月第 N 个”。

## 测试
- `node tools/test-feeds.js`：REAXML 官方文档的 rental 样例（经开源解析器的测试数据，Apache-2.0）+ 3 份仿真数据：导入、改租金、下架都对。
