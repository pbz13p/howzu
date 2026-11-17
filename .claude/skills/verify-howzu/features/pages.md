# 页面体检

主要页面在 390 宽（常见 iPhone）和 360 宽（常见安卓）下能打开、没有页面报错、没有横向溢出（左右能拖动）。

## Sub-features

- 首页、租房列表、查租金、发房源、第一套在租房源页、房东指南、投资测算

## How to get to it (user POV)

- 手机打开这些页面，上下滑动，不应该能左右拖动。

## Driving it with howzu-verify

`node tools/verify/howzu-verify.js run pages`

- 每页检查：返回 200；页面宽度 - 屏幕宽度 ≤ 1px；没有页面脚本报错。390 宽时存一份无障碍结构，方便对比改版前后。

## Gotchas

- 外部服务（地图瓦片、汇率接口）偶尔超时，只看脚本报错，不看网络失败。
