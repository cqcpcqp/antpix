# 庭院里的栗栗

栗栗会出洞、散步、晒太阳、张望、梳理触角和回洞。装备叶片躺椅后会坐下休息，装备露珠水池后会喝水、看倒影。设备当地时间 18:00 到次日 06:00 为夜间，装备灯笼花园后会在灯下活动。种子粮仓作为庭院装饰。

庭院在后台、关卡、弹窗和装修预览期间暂停活动。装修预览隐藏栗栗，关闭后恢复原来的位置和动作。喂食时暂停移动，播完拾取、咬食、咀嚼和吞咽后接回原来的路线。

## 素材与动画

首页皮肤取自定稿 D 版原画 `lili-d-concept.png`。栗栗与水面倒影共享 Spine 3.8 加权网格，庭院时钟推进动画，食物道具跟随嘴部挂点。洞口用 Cocos 模板遮罩裁切角色轮廓。

- `python3 art/homestead/resident-animation/prepare-lili-spine.py` 重建 Spine 网格、贴图和动作。
- `python3 art/homestead/resident-animation/prepare-queen.py` 从 `lili-concept.png` 和 `snacks-parts.png` 重建分件与食物图集 `resident-rig.png`。

## 离线预览

在能找到 `@napi-rs/canvas` 的环境中，可运行以下命令，把预览帧输出到 `temp/previews/`。

```sh
RESIDENT_PREVIEW=chair node scripts/preview-home.cjs
RESIDENT_PREVIEW=pond node scripts/preview-home.cjs
RESIDENT_PREVIEW=night node scripts/preview-home.cjs
QUEEN_PREVIEW=1 node scripts/preview-home.cjs
MEAL_PREVIEW=1 node scripts/preview-home.cjs
```

`npm run check` 验证活动、暂停、洞口裁切、喂食和存档等行为。微信构建统一执行 `npm run build:wechat`。
