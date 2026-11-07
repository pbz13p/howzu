# 好租 Howzu 自动改进记录

## 2026-11-07（第一次运行，预算 $0.50）

**做了什么**
1. 【计算纠错】修了卖房那年 CGT 算多的 bug：以前算卖房年的"基础收入"时，没有扣掉当年已经用掉的上年结转亏损，等于亏损被重复忽略，资本利得会被推进更高税档 → CGT 偏高。
   - 例子：其他收入 $30k、LVR 90%、利率 8%、租金快速增长、持有 3 年：卖房年实际应税收入 $12,774，旧代码当成 ~$18,684。
   - 改法：每年记录 `carryIn`（上年带入的亏损）和 `taxableIncome`（抵扣后应税收入），CGT 以 `taxableIncome` 为基础。
   - 先在 `tools/test-engine.js` 加了测试（确认旧代码会失败、新代码通过），另加边界测试：零收入、LVR 0%、持有 1 年/30 年、房价下跌 -5%。
2. 对着记忆核对了 RULES（这次预算小，没逐条打开官网）：维州印花税表、2024–2033 土地税表、2026-27 个税三档（15%/30%/37%/45%，第一档 15% 是 2025 预算案新降的）、外国居民和打工度假税率 —— 与代码一致。

**测试结果**：`node tools/test-engine.js` 79 项全过；`node tools/test-data.js` 全过。invest.html 手机尺寸打开无 JS 报错。

**待老板确认 / 下一步建议**
- VRLT 空置税：现在每年都按 1% 算。据我了解 2026 年起连续空置第 2 年 2%、第 3 年起 3%（按 CIV）。还没拿到 SRO 原文，**没改**，下次用官网核对后再改。
- 贷款手续费（loanSetup）现在没有作为借款费用在 5 年内摊销抵税（ATO：超过 $100 的借款费用按 5 年或贷款期较短者摊销），导致抵税略少。属于口径问题，请老板决定要不要加。
- 下次要用官网逐条核对：Medicare 低收入门槛 $28,011、MLS 门槛 $105k/$123k/$164k、FIRB 2026-27 费表（$4,600/$15,600/每百万 $31,300）——目前是代码原作者写的数字，本次没有官方原文复核。
- 期限提醒：楼花印花税优惠 2027-04-21 截止（还有约 5 个半月）；外国人二手房禁令到 2029-06-30。

## 2026-11-07（第二次运行，预算 $0.50）

**做了什么**
1. 【老板已拍板】借款费用摊销抵税：贷款手续费/估价费（loanSetup）超过 $100 时，按 5 年或贷款期较短者平均摊销抵扣；持有不到 5 年就卖房（还清贷款），剩余未抵部分在卖房当年一次抵扣；≤$100 第 1 年全抵；没贷款（LVR 0%）不抵。
   - 依据：ATO 借款费用 https://www.ato.gov.au/individuals-and-families/investments-and-assets/residential-rental-properties/rental-expenses-to-claim/borrowing-expenses
   - 简化：每年平均摊（ATO 原文第一年按天数比例），差异很小，已写在代码注释里。
   - 页面"报税时"一行现在显示"借款费用摊销 $xxx"。
2. 【税率核对 · SRO 原文确认】空置住宅税 VRLT 改为累进：连续空置第 1 年 1%、第 2 年 2%、第 3 年起 3%（按 CIV；2025 年前统一 1%）。
   - 原文：https://www.sro.vic.gov.au/about-us/rates-and-statistics/current-rates/vacant-residential-land-tax-current-rates（页面更新于 2026-09-29，本次 2026-11-07 核对）
   - 模型里每年空置周数相同，所以第 y 年就是连续空置第 y 年。页面"计算依据"里写明了税率。
3. 两项都先加了测试：tools/test-engine.js 新增 11 项（借款费用 7 项、VRLT 4 项）。

**测试结果**：`node tools/test-engine.js` 90 项全过；`node tools/test-data.js` 全过。invest.html 手机 390×844 打开、把空置周数改成 30 后无 JS 报错，VRLT 和借款费用都正确显示。

**注意 / 下一步建议**
- VRLT 在 SRO 实际是"按上一年空置情况、下一年征税"，模型里放在当年扣，时间上提前一年，金额影响小，暂不改；如老板要精确可再改。
- SRO 页面还提到另一种 1% VRLT（墨尔本都市区土地连续 5 年未开发、新房建成超过 3 年未用未卖），本工具不涉及。
- 下次继续用官网核对：Medicare 低收入门槛、MLS 门槛、FIRB 2026-27 费表；学区站用真实地址走一遍。
- 期限提醒：楼花印花税优惠 2027-04-21 截止（约 5 个半月）；外国人二手房禁令到 2029-06-30。

## 2026-11-07（第三次运行，预算 $0.50）

**做了什么（税率核对，没有改任何数字，只补了来源和测试）**
1. FIRB 2026-27 申请费：对照 ATO 收费页和财政部 Schedule of Fees v8（2026-07-01 生效）。新房/空地 <$75k $4,600；≤$1m $15,600；≤$2m $31,300（之后每多 $1m 加 $31,300）；二手房 ≤$1m $46,800（=3 倍）。**代码一致**。
   - https://www.ato.gov.au/individuals-and-families/investments-and-assets/foreign-resident-investments/foreign-investment-in-australia/fees-for-foreign-residential-investors
   - https://foreigninvestment.gov.au/sites/foreigninvestment.gov.au/files/2026-06/schedule-of-fees-v8.pdf
2. MLS 医保附加税 2026-27 单身门槛 $105k / $123k / $164k，税率 1% / 1.25% / 1.5%：对照卫生部 privatehealth.gov.au，**代码一致**。
   - https://www.privatehealth.gov.au/health_insurance/surcharges_incentives/medicare_levy.htm
3. Medicare 低收入门槛 $28,011：数字对，但代码注释写的是"2026-27"，其实是 **2025-26** 的门槛（2026 年 5 月预算案宣布，比 $27,222 涨了 2.9%）。2026-27 的门槛通常要到 2027 年 5 月预算案才会定，所以现在用的是已知的最新数字。已经改正了注释。
   - 说明：ATO 官网拦了抓取工具（403），这一项是看多个二手来源互相印证的，**待老板确认** $28,011 的立法是否已经通过。
4. tools/test-engine.js 新增 6 项边界测试：FIRB 刚好 $75k、MLS 四个档位的分界点、Medicare 门槛。

**测试结果**：`node tools/test-engine.js` 96 项全过；`node tools/test-data.js` 全过。

**下一步建议**
- 2027 年 5 月预算案后要更新 Medicare 低收入门槛（2026-27）。
- 还没核对：LITO、外国居民 CGT 折扣、FRCGW（12.5%，门槛 $0）、Div 43 2.5%；学区站真实地址走查；手机截图走查（这三次运行预算都用在税务上了）。
- 期限提醒：楼花印花税优惠 2027-04-21 截止（还有约 5 个半月）；外国人二手房禁令到 2029-06-30。
