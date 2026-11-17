---
name: verify-howzu
description: 好租 Howzu（howzu.com.au）的固定验证工具：在手机尺寸上像真实用户一样走关键流程（房源周租一致、预约看房、房东卡片上架、托管留资、租客留需求、回电、发房源、英文界面、页面体检），留截图和提交内容当证据。改完好租任何页面或 js 后、说“上线了”之前、以及每日线上巡检时使用。
---

# 好租验证工具

一条命令跑完，不要自己临时写 Playwright 脚本。脚本固定，结果才可比、可重复。

## 跑

```sh
node tools/verify/howzu-verify.js run              # 本地起站，跑全部流程，结束自动清理
node tools/verify/howzu-verify.js run book owner   # 只跑改动涉及的流程
node tools/verify/howzu-verify.js run --live       # 对线上 howzu.com.au 跑（只读）
node tools/verify/howzu-verify.js doctor           # 只检查网站能不能开
node tools/verify/howzu-verify.js list             # 列出流程名
```

- 需要 Node 和 Playwright（`require("playwright")` 能用；没有就 `npm i -g playwright && npx playwright install chromium`）、python3（本地起站用）。
- 本地站点固定在 127.0.0.1:8761。端口被占用时工具会拒绝运行，不在别人的实例上跑。只关自己起的进程。
- 退出码：0 全部通过（含“没验证”的流程），1 有失败，2 缺依赖。

## 安全

- 所有写 Supabase 的请求（发房源、留需求、托管、回电、访问统计）都在浏览器里拦下，不进数据库，只把“本来要写什么”存成证据。读数据照常。
- 所以对线上跑也不会产生假询盘，也不会污染访问统计。
- 测试联系方式固定用 `0400 000 000` 和微信 `verify_test`。

## 结果和证据

- 每个流程一行：✅ 通过、❌ 失败（下面列出哪条检查失败、实际看到什么）、⚪ 没验证。
- ⚪ 表示运行环境连不上外部脚本（例如云端沙盒连不上 esm.sh 上的 Supabase 库），**不等于网站坏了**。这时用 `--live` 或等 GitHub 每日巡检的结果。
- 证据在 `.verify/<时间>-local|live/`（已在 .gitignore，清理时不删）：`summary.md`（中文报告）、`summary.json`、每个流程一个目录（截图、提交内容.json、打开的短信.txt、无障碍结构）。
- 汇报时引用 `summary.md` 的结论和截图路径。没跑过这个工具，不能说“上线了、测过了”。

## 什么时候跑哪些

| 改了什么 | 跑 |
|---|---|
| data/listings.json、rent/*.html、build-listing-pages.js | `listings` |
| rentals.html、js/enquire.js | `book tenant listings` |
| rents.html、js/landlord-card.js、js/owner-lead.js | `landlord owner` |
| post.html、js/post-form.js、js/post-parse.js | `post` |
| js/contact-fab.js | `callback` |
| js/i18n*.js | `english` |
| CSS、任何页面布局 | `pages` |
| 不确定 | 全部 |

## 失败了怎么判断

1. 先看截图和 `summary.md` 里的“实际”。
2. 页面真的错了 → 修网站，再跑一次，直到通过。
3. 是网站有意改了（比如按钮改名） → 改脚本和对应的功能地图文件，在提交说明里写清楚为什么改。**不准为了通过而放宽检查**（例如删掉检查、把“= 810”改成“包含 $”）。
4. 每个检查都必须能失败过：新加检查时，故意改坏一处代码，确认它报 ❌，再改回来。

## 功能地图

`features/` 里每个文件是一个用户功能：从哪里进、怎么一步步操作、看到什么才算成功、坑在哪里。脚本里每个流程对应一个文件。加新功能时：先写地图文件，再在 `tools/verify/howzu-verify.js` 里加同名流程，跑通，再证明它能失败。

## 每日线上巡检

`.github/workflows/verify.yml` 每天墨尔本时间早上 6 点左右对线上跑一次 `--live`，证据作为 Actions 附件保留 14 天。失败时 GitHub 会给仓库主人发邮件。
