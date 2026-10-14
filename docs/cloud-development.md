# 微信云开发

当前版本使用 `game` 云函数提供 100 关配置、存档、金币结算、庭院装修和排行榜。微信客户端直接消费固定响应契约，不添加后台返回兜底。

## 更新部署

先执行 `npm run prepare:cloud` 和本地回归，再部署。微信开发者工具需登录并开启服务端口；从项目根目录执行：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy --env cloudbase-d9glil4qk6b5865ba --names game --remote-npm-install --project "$PWD"
```

云端配置曾于 2026-10-10 部署核验；此记录不代表后续本地修改已自动部署。部署后需核对函数状态及客户端登录、购买和存档恢复。

## 环境和首次部署

- AppID：`wxd8e27ad9cd0289df`
- 环境：`cloudbase-d9glil4qk6b5865ba`（已通过 CLI 核对）
- 云函数：`game`，入口 `index.main`；当前平台创建的运行时为 `Nodejs16.13`，超时 20 秒。后续升级运行时需先确认平台支持版本并验证 SDK 兼容性。
- 数据库：CloudBase 文档型数据库。

1. 执行 `npm run prepare:cloud`。云函数里的 `profile.js` 和 `catalog.json` 根据客户端规则生成，不手改。
2. 微信开发者工具导入 `/Users/cqcpcqp/Projects/antpix/build/wechatgame` 进行模拟器试玩。云函数 CLI 部署使用本页命令中的项目根目录；根目录 `project.config.json` 同时指向游戏产物和 `cloudfunctions/`。本机根目录导入曾出现模拟器启动失败，构建目录入口已验证能正常登录，因此当前使用构建目录试玩。游戏源码仍在 Cocos 中开发。
3. 在目标环境的数据库中创建 `players`、`receipts` 两个集合。两者都设为客户端不可读、不可写：自定义安全规则为 `cloudfunctions/database-rules.json` 的内容。云函数使用服务端权限访问。
4. 为 `players` 创建非唯一联合索引：`highest` 降序、`reachedAt` 升序、`_id` 升序。字段顺序见 `cloudfunctions/database-indexes.json`。这两个 JSON 是配置说明，不会自动部署。
5. 在开发者工具中给 `cloudfunctions` 选择目标云环境；对 `game` 执行“上传并部署：云端安装依赖”。或者在云开发控制台创建名为 `game` 的云函数并上传 `cloudfunctions/game` 目录。依赖和锁文件已提供；不把客户端代码上传为云函数。
6. 执行 `WECHAT_APPID=wxd8e27ad9cd0289df npm run build:wechat`，重新编译小游戏，通过真实客户端触发登录。控制台直接测试缺少可信 `OPENID/APPID` 时返回 `UNAUTHORIZED` 是预期行为，不能通过测试参数伪造身份。

首次部署前，微信客户端会停在连接重试界面，不会偷偷切换成本地存档。不要把“代码构建成功”当成“云端部署成功”。本次仓库实现不包含自动登录腾讯云或代付开通。

## 业务规则与数据

- 不迁移开发期本地数据。每个微信账号首次登录创建新存档；旧 `pixel-garden-v1` 留给非微信本地试玩，不上传。
- 微信云函数使用 `getWXContext()` 的 `APPID/OPENID`，校验小游戏 AppID 后派生内部 ID；不接受客户端传入的用户身份、金币余额或最高关卡。
- `players` 保存游戏 `profile`、最高已通关关卡（1 起算，未通关为 0）、首次达到当前最高关卡的时间、`adViews`、当前游戏与广告会话。
- 关内棋盘不存云。重新打开游戏从最高解锁关卡开始；重玩已通关关卡不改变最高进度的首次达成时间。
- 世界榜展示前 100 名，每页 10 人：最高通关关卡降序、首次达成服务器时间升序；毫秒相同时按内部 ID 排序以保持稳定。未通关不上榜，使用随机匿名玩家名，不要求微信昵称头像。
- 领奖、消费、通关、广告计数与请求凭据在同一数据库事务提交。每日奖励以服务器北京时间日历日为准，每日 30、首通每关 100；装扮和价格复用 `profile.ts`。
- 同账号同时开始多局时，最后开始的会话有效；旧会话提交被明确拒绝。
- `receipts` 保存幂等请求摘要与结果。客户端发送前保存待确认请求，断网后用同一请求 ID 重试；下次登录先重放待确认请求。按环境和账号隔离，避免换账号串档。首版不清理凭据，后续如设置保留期，必须同步规定客户端重试有效期。
- 设置中的声音和音乐是设备偏好，本地保存；不影响云端资产。

## 云函数契约

统一使用 `wx.cloud.callFunction({name: 'game', data})`，请求带 `catalogVersion: 4`。

| action      | 额外参数                                             | 功能                           |
| ----------- | ---------------------------------------------------- | ------------------------------ |
| login       | 无                                                   | 创建或读取云存档               |
| start       | requestId、level（0 起算）                           | 检查解锁并创建关卡会话         |
| complete    | requestId、runId、seconds、moves                     | 结算通关、解锁、更新排名       |
| claim       | requestId                                            | 领取当日及首通奖励             |
| shop        | requestId、skin                                      | 购买或装备局内洞口装扮         |
| furnish     | requestId、item                                      | 购买或装备指定庭院装饰         |
| unfurnish   | requestId、slot（entrance / path / garden / living） | 收起指定位置的装饰，保留所有权 |
| adStart     | requestId、runId、placement（speed / slot）          | 创建广告观看会话               |
| adComplete  | requestId、adId                                      | 完整观看回调计数               |
| leaderboard | page（0–9）                                          | 读取世界榜                     |

存档成功响应：`{ok:true, profile, day, serverTime, adViews, highest, reachedAt, output}`。`output` 按操作返回 `userId/runId/adId/amount/purchase`；无额外结果时为空对象。榜单响应：`{ok:true, rows, hasNext}`。业务拒绝：`{ok:false, code, message}`；网络或平台故障由调用 Promise 抛出。客户端严格消费约定字段，不猜测字段、不填默认值。

## 好友榜与广告

好友榜使用 `wx.setUserCloudStorage` 镜像已接受的最高成绩；`wechat/open-data/index.js` 在开放数据域调用 `wx.getFriendCloudStorage`，按同样规则排序。数据 key 为 `ant-progress-v4`。通过 `SubContextView` 渲染，主域不读取或上传好友名单。查看时请求 `scope.WxFriendInteraction` 权限；拒绝后可返回世界榜，在微信设置中允许后重试。构建脚本复制开放数据域并写入 `game.json.openDataContext`。昵称由开放数据域使用系统字体绘制。

二倍速与扩槽使用激励视频，云端在 `adStart` / `adComplete` 后去重增加 `adViews`；只有完整观看后才发放本关便利。关闭广告、加载失败或请求失败均不发奖。

通关已有顺序、会话、时间上界、理论最低耗时、容器数校验，但没有完整操作回放验证，不能阻止所有伪造成绩。首版排行榜无现金或实物奖励。好友榜是客户端镜像，世界榜以数据库为准。

## 验证与待完成的真机检查

本地：`npm run check`、`npm run build:wechat`。云端规则测试采用事务存储替身，验证原子操作、重试、隔离与排序，不能替代 CloudBase 实际事务并发测试。

部署后验证：两个微信账号首次登录；通关后重启/换设备；同分先后顺序；跨北京时间零点领奖；请求发出后断网、恢复后重试；两个设备同时领奖/购买；好友权限拒绝和允许；激励广告关闭、完整观看、加载失败与云端广告会话失败。

`wx-server-sdk` 固定为 4.0.2，并提供 lockfile。`npm audit` 发现 SDK 的传递依赖公告（axios、lodash.set/unset 等）；不能用强制降级旧 SDK 代替兼容性验证。上线前需跟进官方修复并再次审核依赖。云函数输入只接受固定业务字段，不接收任意数据库查询或对象路径。

参考：

- https://developers.weixin.qq.com/minigame/dev/wxcloud/guide/init.html
- https://developers.weixin.qq.com/minigame/dev/wxcloud/reference-sdk-api/utils/Cloud.getWXContext.html
- https://developers.weixin.qq.com/minigame/dev/wxcloud/reference-sdk-api/database/Database.runTransaction.html
- https://developers.weixin.qq.com/minigame/dev/api/open-api/data/wx.getFriendCloudStorage.html
- https://developers.weixin.qq.com/minigame/dev/api/open-api/data/wx.setUserCloudStorage.html

## 请求状态展示

云端请求不再打开独立的连接弹窗。首页同步、开局与领奖在首页内容区展示状态；商店在原抽屉内展示，排行榜先展示榜单容器再加载内容。错误在原内容区点击重试，写请求继续复用持久化的请求 ID，不提前发放资产。启动同步完成前不展示占位金币和关卡进度，也不允许开局；设置和收藏说明仍可使用。关闭榜单会忽略该次请求的迟到结果，登录完成不会关闭用户正在查看的设置。
