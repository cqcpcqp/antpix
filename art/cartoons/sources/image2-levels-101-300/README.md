# 第 101–300 关素材

2026-11-14 使用 underelay / gpt-image-2 生成。200 张最终原图均为 1024×1280（4:5），画幅不合格的结果已重新生成，没有裁切。新增关卡颜色经用户确认延续 19–24 色，最终网格为 48×60。

`manifest.json` 保存题材、完整提示词、来源、实际色数与验收状态。用户已于 2026-11-14 明确授权“图片不需要用户验收，直接上就行”。本批 200 张图片的 `approved` 均为 `true`，已接入正式游戏和本地云端目录。[原图与像素图对照画册](review-48x60/README.md) 保留供查看。

`candidate-levels.ts` 包含原有 100 关和新增 200 关，已生成每关三套容器方案；前 100 关的完整关卡对象（包括容器方案）与正式版本一致。`container-plan-report.json` 保存对应方案指标与哈希。原图属于制作素材，不会打进游戏包。

独立预览项目位于仓库内 `temp/levels-300-preview/`，使用候选目录及覆盖 300 关名称的字体，与正式目录使用相同关卡数据及字体。微信构建产物位于其 `build/wechatgame/`，微信客户端产物仅做本地验证，尚未发布。2026-11-14 已按用户要求部署 `game` 云函数，下载核对 6 个云端文件与本地一致，状态为 Active，云端共 300 关。

## 重现数据检查

在项目根目录执行：

```sh
python3 scripts/check-catalog-images.py \
  art/cartoons/sources/image2-levels-101-300/candidate-levels.ts \
  art/cartoons/sources/image2-20261010 \
  art/cartoons/sources/image2-levels-011-100 \
  art/cartoons/sources/image2-levels-101-300
node --experimental-strip-types --import ./scripts/register-typescript.mjs \
  scripts/check-candidate-levels.mjs \
  art/cartoons/sources/image2-levels-101-300/candidate-levels.ts \
  art/cartoons/sources/image2-levels-101-300/container-plan-report.json \
  art/cartoons/sources/image2-levels-101-300/gameplay-validation.json
```

像素检查逐点比对 300 张验收 PNG；玩法检查使用正式 GardenModel 回放每关三套方案，验证颜色容量、五个槽位、路径可达性与完整送达。本批接入依据为用户的直接授权，自动检查只验证数据和玩法。

## 已完成的验证

- 200 张最终原图全部为原生 4:5，无裁切；200 张像素图均为 48×60，实际色数 19–24。
- 300 张候选图与验收 PNG 的全部像素一致，300 个画面无重复；前 100 关完整对象保持一致。
- 源码侧 300 关共 900 套方案全部通关，结果见 `gameplay-validation.json`。
- 独立预览的字体覆盖 911 个字符，300 关 / 30 页选关导航与锁定规则通过。
- 独立预览微信包：主包 3156.5 KiB，资源分包 2044.5 KiB，总包 5200.9 KiB。
- 正式项目 `npm run check` 通过，461 项测试全部通过；正式 100 关分包构建已通过。

## 正式接入验证

用户授权后已将相同关卡、字体及云端配置接入正式目录。正式与独立构建的全部 assets、settings、wechat 输入逐文件哈希一致；相同微信产物已同步至项目根目录 `build/wechatgame/`。Cocos 编译产物的 900 套方案全部回放通过，9,030 局随机操作的不变量检查通过，30 页选关通过。

300 关全量测试共 1,061 项，首次有一项旧测试写死 10 页；修正为按关卡数计算后，该文件全部 7 项复跑通过。构建后的云端、离线、启动及交互共 33 项复跑全部通过。格式、ESLint、架构、类型及无浏览器 UI 检查通过。机器可读记录见 `integration-validation.json`。
