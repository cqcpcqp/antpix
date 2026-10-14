# 代码组织与开发约定

实现与重构规则以根目录 [agent.md](../agent.md) 为准，本页提供业务导航与验证方式。

## 从哪里开始读

当前版本包含 100 幅已验收的原创画作，网格为 48×60。关卡顺序以 `assets/scripts/domain/levels/levels.ts` 及 `art/cartoons/runtime-catalog.json` 指定的 manifest 为准。素材重建见 [素材维护](assets.md)。

| 要理解或修改的内容                   | 入口                                           | 职责边界                                 |
| ------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| 场景生命周期转发                     | `assets/scripts/PixelGarden.ts`                | 仅委托 app/GardenRuntime 及控制器        |
| 容器选择、可达像素、预占、取块、送达 | `assets/scripts/domain/game/model.ts`          | 纯规则，不引用 Cocos、存储或页面         |
| 寻路、路径合并、距离和姿态采样       | `assets/scripts/domain/routing/routing.ts`     | 纯算法，使用网格坐标                     |
| 画板布局、槽位位置、坐标转换         | `assets/scripts/presentation/boardLayout.ts`   | 纯布局，明确网格坐标与画面坐标的边界     |
| 像素与蚂蚁绘图                       | `assets/scripts/presentation/gardenDrawing.ts` | 不改模型或组件状态，运行时和离线图集共用 |
| 存档迁移、奖励、装扮、最佳成绩       | `assets/scripts/domain/profile/profile.ts`     | 纯存档规则；实际读写由组件执行           |
| 微信激励视频调用                     | `assets/scripts/platform/wechat/rewardAd.ts`   | 平台适配，测试广告界面由组件负责         |
| 关卡与调色板数据                     | `assets/scripts/domain/levels/levels.ts`       | 自动生成，不手改                         |

依赖方向：组件调用规则、寻路、布局、绘图和平台适配；纯规则模块不反向依赖组件。不要通过创建 `utils.ts`、`helpers.ts` 等笼统文件来混放不相关逻辑。只有具备明确职责、实际调用方和稳定输入输出时才提取模块。

## 让流程可以顺着读

`PixelGarden.update()` 按以下顺序组织一帧：

1. 更新浮层、音乐和通关动画；检查是否暂停或被页面遮挡。
2. 更新长按预览，用真实 `dt` 累计游戏用时。
3. 将动画步长限制到 0.05 秒，移动待选卡片。
4. `dispatchAnts()` 让每个槽位独立派工。
5. `updateFlights()` 推进搬运状态；`updateAntVisual()` 更新显示姿态。
6. 重绘变动行、更新送达进度、检查通关和阻塞。

派工必须先于在途任务更新。派工搜索使用预订后的预计棋盘，实际取块和移动使用真实棋盘；改变更新顺序会改变玩法时序。真实游戏计时不能使用截断后的动画步长。

全部待选容器放入槽位后，自动进入免费 4× 收尾加速，同步加快派工、容器发射和蚂蚁搬运，仍按原规则避障、取块和送达。槽位暂时满但队列未空时不触发。收尾期间速度按钮显示 4× 并隐藏广告标记，不再开启倍速广告；重新开始或进入下一关恢复 1×，广告解锁状态仍仅限本关。

任务状态依次为 `outbound → grasp → return → enter`。派出时 `pick()` 只预占；接触目标时 `lift()` 清除像素并打开通路；入洞时 `arrive()` 才计入收集。最后一次派工立即释放槽位，旧任务通过 `jarId` 结算，不能按当前槽位结算。

## 写代码的约定

- 使用业务名称：`pickup`、`trip`、`jar`、`slot`；循环索引可以简写，跨多个步骤的状态不要使用含糊的单字母名称。
- 一个函数完成一个可命名的步骤。流程入口应以步骤调用为主，复杂计算和渲染放在具体函数中。
- 一行表达一个主要操作；复杂条件分行，状态变更不要挤成一整行。使用四空格缩进，编辑器配置见 `.editorconfig`。
- 注释解释约束和原因，例如为什么预占不能打开通路、为什么只在变化时写节点变换；不要逐句重复代码。
- 使用已有类型和接口，先查询调用方及数据来源，再修改。后台返回契约固定，禁止为后台响应添加默认值、字段猜测、类型兼容或兜底。
- 历史本地存档迁移和资源加载失败属于各自已有的边界处理，不要把这些机制扩散到纯规则中。
- 性能敏感代码保留行缓存、对象池、路径预计算和姿态对象复用；可读性重构也要验证逐帧行为。
- 新增 Cocos 脚本附带 `.meta`；不要移动或修改场景组件的 UUID。不要手改 `build/`、`library/`、`temp/` 中的生成代码。

## 怎样验证

本机 Node.js 24 与 Cocos Creator 3.8.8 已提供所需工具。首次使用执行 `npm ci` 安装开发依赖。日常修改执行 `npm run format` 统一排版，执行 `npm run lint` 检查代码问题。`npm run check` 依次运行格式检查、ESLint、结构检查、云端规则生成、规则测试、严格类型检查和无界面组件回归。组件回归使用模拟渲染器，不打开浏览器。

涉及派工、动画或性能时再运行 `npm run bench:animation`。行为对比关注 `behaviorHash`、帧数、峰值蚂蚁数和变换写入次数；CPU 耗时有波动，不代表真机 FPS。

涉及绘图时执行 `npm run generate:ants -- --check`，验证图集与共享绘图一致。该开发工具需要可解析的 `@napi-rs/canvas`，可通过 `NODE_PATH` 指向已有依赖。

UI 使用不含描边的白色位图字库，由 Label 的颜色区分标题、正文和辅助信息；容器数字保留独立字库。新增文案或画作名称后，先运行 `python3 scripts/prepare-game-font.py`，再运行 `node scripts/prepare-bitmap-font.cjs`（需要 fonttools、Pillow 与 `@napi-rs/canvas`）。两步必须一起执行，否则旧 TTF 子集可能把新字符烘焙成空白。`npm run check:ui` 会验证交付字库的字符覆盖及非空字形。

运行 `node scripts/preview-ui.cjs` 可离线渲染主要页面，默认输出到 `temp/previews/ui-390x844/`；通过 `PREVIEW_WIDTH` 和 `PREVIEW_HEIGHT` 检查其他屏幕比例。该工具使用实际位图字体、贴图和组件节点，模拟字体缩放与九宫格；它不是 Cocos 或真机截图，不能测量实际帧率和触摸行为。

涉及新增模块或 Cocos 转译时执行 `npm run build:wechat`；构建脚本自动回归真实微信产物。源码回归不能代替产物回归。

未在对话中获得浏览器使用授权时，不打开浏览器测试。屏幕适配、GPU 表现和微信生命周期还需要按任务范围在真机验证。

## 模块导航

`app/GardenRuntime.ts` 显式组装控制器，`app/Lifecycle.ts` 管理启动与释放，`app/GameLoop.ts` 明确每帧门控与执行顺序。`features/home` 管理主页、选关、商店、排行榜与设置；`features/gameplay` 管理关卡、容器、预览、蚂蚁派工与动画；`features/courtyard` 管理庭院呈现；`features/ui` 管理界面基础元素和弹层。

领域规则位于 `domain`，不依赖 Cocos。`domain/game/PlannedExposure.ts` 只管理预占后的预计连通性，真实移除与送达仍由模型处理。寻路的几何、搜索缓存、单目标/多目标搜索和采样分别存放，公开入口仍是 `domain/routing/routing.ts`。底层绘图与坐标转换在 `presentation`，微信调用在 `platform/wechat`。

模块构造时仅保存明确声明的协作者并分配自身状态；不能触发尚未完成组装的其他控制器。测试直接观察状态所有者，不在场景入口保留旧字段兼容代理。

`npm run check:architecture` 检查模块分层、运行时循环导入和 Cocos 脚本元数据；ESLint 限制手写文件不超过 400 行。`scripts/check-ui.cjs` 只组织有序检查，断言按场景放在 `scripts/ui-checks`。

## 自动格式化与静态检查

Prettier 负责排版，ESLint 使用 JavaScript / TypeScript 推荐规则检查代码问题，`eslint-config-prettier` 关闭与格式化冲突的规则。配置分别见 `.prettierrc.json`、`.prettierignore` 和 `eslint.config.mjs`。保留单引号，行宽为 100，缩进遵循 `.editorconfig`。

检查覆盖手写业务代码、云函数、微信开放数据域、开发脚本和测试。构建缓存、素材数据、Cocos 场景及设置、自动生成的 `assets/scripts/domain/levels/levels.ts`、`cloudfunctions/game/profile.js` 和云端关卡目录不参与排版；生成代码不参与 ESLint。请修改对应源文件或生成脚本。

尚未清理的历史 ESLint 问题记录在 `eslint-baseline.json`。`npm run lint` 使用基线，阻止同文件同规则的问题数增长或其他新错误；`npm run lint:all` 显示全部问题（当前会退出失败）。基线按文件和规则计数，不能识别同数量的问题替换。修复已有问题后执行 `npm run lint -- --prune-suppressions` 清理基线；不要通过扩大基线跳过新增问题。
