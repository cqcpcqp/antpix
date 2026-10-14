# 当前素材维护

所有命令从项目根目录执行。源图、已验收像素、字体许可与运行素材属于项目源码；预览、日志和候选工程不提交 Git。生成或替换关卡图前先读 `docs/level-image-memory.md`。

## 工具依赖

规则测试和类型检查使用 Node.js 24 与 Cocos Creator 3.8.8。素材加工另需 Python 的 Pillow、numpy、fonttools；音乐加工还需 imageio-ffmpeg，Node 离线绘制需 @napi-rs/canvas。

新机器可安装到忽略目录，避免把工具依赖提交到项目：

```sh
python3 -m venv temp/art-tools
. temp/art-tools/bin/activate
python -m pip install Pillow numpy fonttools imageio-ffmpeg
npm install --prefix temp/level-image-font-tools @napi-rs/canvas
export NODE_PATH="$PWD/temp/level-image-font-tools/node_modules"
```

当前本机已有的 `temp/pixel-research-libs`、`temp/ui-font-libs` 也可通过 `PYTHONPATH` 使用；它们是工具安装目录，不是素材源文件。

## 从已验收像素重建关卡

`art/cartoons/runtime-catalog.json` 指定正式来源。生成器读取各 manifest 的 `runtimePixelFile`，拒绝未验收图片。不要手改自动生成的关卡数据；生成图片数据后必须接着生成容器方案。

```sh
python3 scripts/generate-image2-levels.py
npm run generate:containers
npm run prepare:cloud
python3 scripts/check-catalog-images.py assets/scripts/levels.ts art/cartoons/sources/image2-20261010 art/cartoons/sources/image2-levels-011-100
npm run check
```

每关生成三个容器方案，按颜色容量总和等于画作像素数；`art/container-plan-report.json` 是测试输入，应随关卡数据提交。源码及构建回归逐一验证全部方案存在完整通关路径，不保证任意选择都能通关。

新增画作名称后还需重建字库；客户端与云函数 catalog 要配套部署，构建不会自动部署云端。

## 新图片转换与审阅

在独立来源目录准备原图和 manifest，未经用户确认的条目保持 `approved: false`。用 `scripts/optimize-level-pixels.py --source 来源目录` 生成 48×60 像素和对照图。第 11–100 关使用 `--anchor-dark` 转换，第一批 10 关不带此参数；转换算法变化会改变图像，须重新验收。

`--resume` 复用已存在像素，用于重新生成对照图而不改写已验收像素。`scripts/prepare-level-review.py 来源目录` 可生成分页审阅页面。候选数据可用 `scripts/generate-image2-levels.py --source 来源目录 --candidate --output art/候选目录/levels.ts` 生成；关卡编号须连续从 1 开始，扩展目录可通过多个 `--source` 与正式前序目录组合。

对照图片与页面不提交 Git；保留用户确认后的原图、最终提示词、manifest 和正式像素。任何浏览器预览仍需对话中的明确授权。

## 字体、UI、庭院和音频

| 资源               | 输入                                                | 加工脚本                                                   |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------- |
| UI 字体子集        | `art/fonts/noto-NotoSansSC[wght].ttf`、当前文案     | `scripts/prepare-game-font.py`                             |
| UI 位图字库        | `assets/resources/fonts/ant-nest-heavy.ttf`         | `scripts/prepare-bitmap-font.cjs`                          |
| 容器数字           | 当前数字排版代码                                    | `scripts/prepare-container-digits.cjs`                     |
| 容器图集           | `art/ui/sources/containers.png`                     | `scripts/prepare-container-atlas.py`                       |
| 木托盘、橡果       | `art/ui/sources/wood-tray.png`                      | `scripts/prepare-wood-trays.py`                            |
| 洞口               | `art/ui/sources/wood-hole.png`                      | `scripts/prepare-wood-nest.py`                             |
| 局内背景           | `art/ui/sources/game-background.png`                | `scripts/prepare-sage-background.py`                       |
| 首页按钮与标题     | `art/ui/sources/home-actions.png`、`home-title.png` | `scripts/prepare-home-actions.py`、`prepare-home-title.py` |
| 庭院与装饰         | `art/homestead/` 正式原图                           | `art/homestead/prepare-assets.py`                          |
| 蚂蚁与货物图集     | `assets/scripts/gardenDrawing.ts`                   | `npm run generate:ants`                                    |
| 点击音效           | 合成参数                                            | `scripts/prepare-tap.py`                                   |
| 背景音乐和通关音效 | Easy Lemon 原始音乐、合成参数                       | `scripts/prepare-audio.py /path/to/Easy-Lemon.mp3`         |

新增 UI 文案或关卡名称时，依次运行 `python3 scripts/prepare-game-font.py` 和 `node scripts/prepare-bitmap-font.cjs`，再运行 `npm run check:ui`。这两步必须一起执行，不能只更新位图而保留旧字体子集。

绘图代码修改后运行 `npm run generate:ants`；`npm run generate:ants -- --check` 检查图集与共享绘图一致。修改运行素材后重新构建，不修改 `.meta` UUID。

## 离线预览

`node scripts/preview-ui.cjs` 默认输出 `temp/previews/ui-390x844/`。可用 `PREVIEW_WIDTH`、`PREVIEW_HEIGHT` 检查尺寸，用 `PREVIEW_OUT` 指定输出目录。首页和容器专项预览分别使用 `scripts/preview-home.cjs`、`scripts/preview-container-launch.cjs`，同样输出到 `temp/previews/`。

这些工具读取当前组件与素材，不打开浏览器；离线结果不能替代 Cocos 或微信真机的触摸、性能验证。
