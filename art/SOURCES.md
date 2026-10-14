# 当前素材来源

## 关卡

当前 100 幅原图由 underelay `gpt-image-2` 生成，均经用户验收，运行网格为 48×60。

- 第 1–10 关：`cartoons/sources/image2-20261010/`。
- 第 11–100 关：`cartoons/sources/image2-levels-011-100/`。
- 正式来源目录由 `cartoons/runtime-catalog.json` 指定。各 manifest 保存关卡顺序、原图文件、色数、验收状态与正式像素文件路径。
- `prompts.jsonl` 保存当前原图对应的最终提示词；`review-48x60/` 中的像素 PNG 是正式关卡重建输入，必须保留。
- 游戏仅加载 `assets/scripts/domain/levels/levels.ts`，原图不打入游戏包。

## UI 与庭院

当前首页按钮、标题、容器、木托盘、洞口和局内背景的加工源图与提示词位于 `ui/sources/`。木托盘源图虽包含多个方案，但加工器需要其中选定区域，不能按“对比图”删除。

庭院背景、12 件装饰的原图、风格参考和提示词位于 `homestead/`。运行资源为 `assets/resources/home/garden.jpg` 和 `furnishings.png`。

## 字体、声音与样式

- 字体：Noto Sans SC，源字体和 OFL 许可在 `fonts/`，正式子集使用 700 字重及 Ant Nest Heavy 家族名。
- 点击与通关音效由本项目脚本合成；背景音乐为 Kevin MacLeod 的 Easy Lemon。
- UI 样式使用 animal-island-vue 的设计 token 与原生 Cocos 适配。
- 字体、音乐和样式许可完整内容见根目录 `THIRD_PARTY_NOTICES.md`，不可随过程素材删除。

加工命令见 `docs/assets.md`（相对于项目根目录）。
