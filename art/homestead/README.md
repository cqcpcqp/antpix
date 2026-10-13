# 庭院正式素材

原图由 underelay `gpt-image-2` 生成。当前源文件：

- `garden-reference.jpg`：庭院生成的风格参考。
- `courtyard-base.png`、`courtyard-base-prompt.txt`：空庭院原图与提示词。
- `furnishings-sheet.png`、`furnishings-prompt.txt`：12 件装饰原图与提示词。
- `prepare-assets.py`：裁切、清理低透明度噪点并生成运行资源。

从项目根目录执行 `python3 art/homestead/prepare-assets.py`，生成 `assets/resources/home/garden.jpg` 和 `furnishings.png`。原装饰图为 1225×1284，按实际物件边界裁切，不拉伸整图；输出图集 1024×768，每格 256×256。

图集每列对应门廊、小路、花园、生活角，每行对应基础、中级、高级装饰。购买不影响局内难度、加速、槽位或排行。云函数部署见 `docs/cloud-development.md`（相对于项目根目录）。
