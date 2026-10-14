# 庭院小住户

## 已实现

- 三只常驻角色：原色棕蚁、偏深色的小围巾蚂蚁、较小的暖红色蚂蚁。独立活动计时、错峰出洞；休息位置和停留时间有所变化。
- 空庭院也有出洞、散步、晒太阳、回洞循环。
- 叶片躺椅：预约单个座位，走近、坐下、躺卧呼吸、起身离开。胖棕蚁更偏好躺椅，其他住户偶尔使用。
- 露珠水池：岸边喝水与看倒影分成两个互动位置，增加水纹、低透明度倒影与俯身动作。
- 种子粮仓：两只住户集合后共同搬一颗种子，移动期间保持两者与种子的相对位置，到粮仓前放下，再各自离开；有重复事件间隔。
- 灯笼花园：设备当地时间 18:00–次日 06:00 为夜间，庭院增加夜色、星点、暖灯光晕与萤光小点；三只住户走到灯下挥手聚会，天亮或收起灯笼后结束。夜色只覆盖庭院，不影响首页按钮。
- 路径交会时短暂让行并平滑侧移；洞口预约通行，角色按前后位置调整绘制顺序。
- 收起水池/粮仓/灯笼会中止对应互动；收起躺椅会让使用者起身离开。未购买或未布置的家具不能触发活动。
- 后台、关卡和弹窗期间不更新庭院活动。装修预览隐藏角色，关闭后恢复；重建装饰节点不重置角色状态。

这是本地表现层，不修改存档、金币、购买规则或后端接口。叶片躺椅、粮仓、水池仍共用已有生活角槽位，不新增同时布置规则。

## 素材与动画

`source.png` / `prompt.txt` 是基础八姿势；`interactions.png` / `interaction-prompt.txt` 是四个互动姿势。均使用 Underelay gpt-image-2、codex-image CLI Images edit 生成，分别请求 1536×1024、1536×512，quality=high。

`prepare.py` 清理白底、统一脚底位置，生成 512×384、128 色透明图集，并提取现有背景的洞口遮挡。执行 `python3 art/homestead/resident-animation/prepare.py` 可重建运行素材。角色采用十二姿势图集配合程序动画：迈步帧随实际路程切换、轻微起伏、坐下升降、呼吸、喝水点头和挥手；没有引入骨骼运行库。

程序入口：`assets/scripts/courtyardColony.ts` 管理场景事件和资源预约，`courtyardLife.ts` 管理单只动作，`courtyardResident.ts` 显示角色，`courtyardAtmosphere.ts` 显示水纹、种子和夜间氛围。

## 离线预览与验证

安装的工具运行库提供 @napi-rs/canvas，设置 NODE_PATH 后可执行：

```sh
RESIDENT_PREVIEW=chair node scripts/preview-home.cjs
RESIDENT_PREVIEW=pond node scripts/preview-home.cjs
RESIDENT_PREVIEW=seed node scripts/preview-home.cjs
RESIDENT_PREVIEW=night node scripts/preview-home.cjs
```

每种场景输出 40 秒、12fps 的 `temp/previews/resident-<场景>/` 帧，基于实际节点和行为进行离线渲染，并非浏览器或真机录屏。预览输出不作为项目资源保留，需要时执行上述命令重新生成。

行为与生命周期测试位于 `tests/courtyard-colony.test.mjs`、`tests/courtyard-life.test.mjs`、`tests/courtyard-ui.test.mjs`，包含活动完整循环、预约、水池移除、搬运同步、昼夜切换、频繁换家具、暂停和长帧。

微信构建统一执行 `npm run build:wechat`。脚本在 Cocos 编译后复制 open-data、生成完整配置和法律说明，并运行 `check-wechat-package.cjs` 验证入口文件及 4 MiB 包体限制；不要用单独 Creator 编译代替完整流程。

## 包体

角色资源采用小尺寸透明 PNG。离线字体文件 `ant-nest-heavy.ttf` 位于 `art/fonts/`，运行时仍使用既有位图字体，避免重复装入字体轮廓。

## 本次验证结果

- `npm run check`：437 项测试通过，格式、lint、类型与 UI 检查通过。
- `npm run build:wechat`：完整构建及构建后回放检查通过；主包 3958.6 KiB / 4096 KiB，open-data/index.js 与源文件一致。
- 已查看四种场景的离线渲染。未打开浏览器，未声称微信真机验收通过。

## 补充回归检查

- 150 组随机种子与家具组合、累计约 25 小时模拟，未发现活动卡住或无法回洞。
- 修正喝水、照镜子和聚会过渡时误用晒太阳坐姿；修正不同尺寸住户的脚底与影子对齐，并新增两项回归测试。
- 重新检查水池与夜间场景离线帧；确认角色图集及洞口遮挡素材在微信构建中与源文件一致。
