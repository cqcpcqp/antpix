# 排行榜 C 方案美术

- `reference-c.png`：用户选择的 C 方案，供生成和验收对照。
- `components-master.png` / `panel-master.png`：Underelay `gpt-image-2.5-sunburst` 经本机 codex-image CLI 生成的原始 RGBA 素材。
- `*-prompt.txt`：实际使用的提示词。
- `generate.py`：通过已安装 CLI 重现生成请求；仅从本机配置读取凭证，不保存密钥。
- `prepare.py`：裁切透明边、等比缩小、合成共享图集，生成 `leaderboardArt.ts` 区域定义。

面板原始返回尺寸为 1122 × 1402，与请求的 640 × 1280 不一致；保留原图，未强制拉伸。运行时通过九宫格延展空白中心，保留花叶和边框的比例。返回按钮也只延展空白中心，叶饰保持原有形状。

重新打包：

```sh
python3 art/leaderboard/laurel-v2/prepare.py
npx prettier --write assets/scripts/presentation/leaderboardArt.ts
```

运行 `scripts/preview-leaderboard.mjs` 可用实际 UI 节点生成离线预览，包含长昵称、匿名头像、前 100 名滚动到底、小屏授权入口。预览中的彩色人脸为测试头像，正式游戏展示微信头像或图集中的匿名蚂蚁；预览不等于真机 GPU 截图。

图集通过启动资源门控加载，在应用销毁时统一释放；关闭排行榜只释放该页面的远程微信头像，不能销毁共享美术帧。正式构建校验同时确认资源路径可加载、图集 PNG 与源文件一致，以及 Mask 等必要组件存在。
