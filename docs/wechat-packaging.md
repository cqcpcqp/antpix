# 微信小游戏分包

公共图片、位图字体、音频仍由 `assets/resources/` 管理，原路径与 UUID 保持不变。该目录使用 `local-subpackage` Bundle 配置，在微信平台构建成 `subpackages/resources/` 普通分包；Web 和原生平台继续使用本地资源包。

小游戏启动时由 Cocos 预加载 `resources` 分包，再进入场景，现有 `resources.load()` 调用继续工作。当前公共资源都是首屏或基础玩法需要的素材，因此这一分包会在启动阶段下载；它释放主包容量，但不意味着首次启动下载总量减少。

原生启动画面先于 Cocos 运行。`scripts/install-startup.mjs` 将启动所需的庭院背景和标题复制到主包 `startup/artwork/`，使下载分包期间仍能绘制启动画面。这两张图片在总包中有副本，体积已计入检查。

`npm run build:wechat` 在保留 AppID 后清理旧的微信构建目录，避免切换分包布局后旧资源残留在主包。`scripts/wechat-package.cjs` 按最终 `game.json` 的分包根目录统计主包和各分包，检查主包 4 MiB、总包 30 MiB，以及独立分包 4 MiB 的限制。普通分包不使用单独的 4 MiB 限制。构建检查也确认分包在 Cocos 设置中注册，并逐一比对真实构建资源。

关卡原图位于 `art/cartoons/sources/`，不会直接进入游戏包。运行时使用 `assets/scripts/domain/levels/levels.ts` 中的压缩像素、调色板和容器方案。增加到 300 关时先检查实际构建体积；无需仅因关卡数量增加而把原图打进分包。未来资源规模增长时，可以继续增加按需加载的 Asset Bundle。

参考：[微信分包规则](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html)、[Cocos Creator 3.8 小游戏分包](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html)。
