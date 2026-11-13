# 微信云开发

当前版本使用 `game` 云函数提供 100 关配置、存档、金币结算、庭院装修和排行榜。微信客户端直接消费固定响应契约，不添加后台返回兜底。

## 更新部署

先执行 `npm run prepare:cloud` 和本地回归，再部署。微信开发者工具需登录并开启服务端口；从项目根目录执行：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy --env cloudbase-d9glil4qk6b5865ba --names game --remote-npm-install --project "$PWD"
```

云端配置曾于 2026-10-10 部署核验；此记录不代表后续本地修改已自动部署。部署后需核对函数状态及客户端登录、购买和存档恢复。

2026-10-14 已同步部署最新 100 关配置，并修正最低耗时下限：按 9 槽、全程 4× 的保守最快情况计算，扣除每个容器首次立即派出的蚂蚁，忽略行走和入槽耗时，保留 2 秒余量。第 17 关允许 90/94 次投放，最低耗时约 36.69 秒。部署后函数状态为 Active，下载的 6 个云端文件与本地逐字节一致；相关 20 项本地测试通过，真机通关仍需验证。

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

首次云登录遇到平台/网络故障时，客户端会进入独立的本地模式；云登录约 8 秒无响应也会进入本地模式。后端业务拒绝仍按原错误展示，不转换为离线成功。不要把“代码构建成功”当成“云端部署成功”。本次仓库实现不包含自动登录腾讯云或代付开通。

## 业务规则与数据

- 不迁移开发期本地数据。每个微信账号首次登录创建新存档；旧 `pixel-garden-v1` 留给非微信本地试玩，不上传。
- 微信云函数使用 `getWXContext()` 的 `APPID/OPENID`，校验小游戏 AppID 后派生内部 ID；不接受客户端传入的用户身份、金币余额或最高关卡。
- `players` 保存游戏 `profile`、最高已通关关卡（1 起算，未通关为 0）、首次达到当前最高关卡的时间、`adViews`、当前游戏与广告会话。
- 关内棋盘不存云。重新打开游戏从最高解锁关卡开始；重玩已通关关卡不改变最高进度的首次达成时间。
- 世界榜展示前 100 名，每页 10 人：最高通关关卡降序、首次达成服务器时间升序；毫秒相同时按内部 ID 排序以保持稳定。未通关不上榜，仅展示随机匿名玩家名，当前玩家显示“我”。
- 领奖、消费、通关、广告计数与请求凭据在同一数据库事务提交。每日奖励以服务器北京时间日历日为准，每日 30、首通每关 100；装扮和价格复用 `profile.ts`。
- 同账号同时开始多局时，最后开始的会话有效；旧会话提交被明确拒绝。
- `receipts` 保存幂等请求摘要与结果。客户端发送前保存待确认请求，断网后用同一请求 ID 重试；下次云登录先重放待确认请求；离线游玩不删除、重放或改写云端待确认请求。按环境和账号隔离，避免换账号串档。首版不清理凭据，后续如设置保留期，必须同步规定客户端重试有效期。
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

## 广告

二倍速与扩槽使用激励视频，云端在 `adStart` / `adComplete` 后去重增加 `adViews`；只有完整观看后才发放本关便利。关闭广告、加载失败或请求失败均不发奖。

通关已有顺序、会话、时间上界、理论最低耗时、容器数校验，但没有完整操作回放验证，不能阻止所有伪造成绩。首版排行榜无现金或实物奖励。世界榜以数据库为准。

## 验证与待完成的真机检查

本地：`npm run check`、`npm run build:wechat`。云端规则测试采用事务存储替身，验证原子操作、重试、隔离与排序，不能替代 CloudBase 实际事务并发测试。

部署后验证：两个微信账号首次登录；通关后重启/换设备；同分先后顺序；跨北京时间零点领奖；请求发出后断网、恢复后重试；两个设备同时领奖/购买；激励广告关闭、完整观看、加载失败与云端广告会话失败。

`wx-server-sdk` 固定为 4.0.2，并提供 lockfile。`npm audit` 发现 SDK 的传递依赖公告（axios、lodash.set/unset 等）；不能用强制降级旧 SDK 代替兼容性验证。上线前需跟进官方修复并再次审核依赖。云函数输入只接受固定业务字段，不接收任意数据库查询或对象路径。

参考：

- https://developers.weixin.qq.com/minigame/dev/wxcloud/guide/init.html
- https://developers.weixin.qq.com/minigame/dev/wxcloud/reference-sdk-api/utils/Cloud.getWXContext.html
- https://developers.weixin.qq.com/minigame/dev/wxcloud/reference-sdk-api/database/Database.runTransaction.html

## 请求状态展示

### 启动 90% 与 SDK 回调回归

审核截图中的 `Cannot read properties of undefined (reading 'result')` 对应旧客户端直接读取 `await wx.cloud.callFunction(...)` 的结果。用直接返回 `undefined`、稍后通过 `success/fail` 通知完成的 SDK 替身可稳定触发旧实现提前失败；这证明错误机制，不代表已确认审核真机上的 SDK 触发条件。

客户端现在显式用 `success/fail` 封装 Promise，成功时直接读取固定的 `response.result`，失败时原样交给云会话重试，不添加后端响应兜底。可独立运行回归：

```sh
node --experimental-strip-types --import ./scripts/register-typescript.mjs --test tests/cloud-transport.test.mjs tests/cloud-ui.test.mjs
```

传输测试覆盖异步成功、平台失败、业务拒绝、同步抛错；场景测试使用直接返回 `undefined` 的回调 SDK，验证等待登录时停在 90%、登录成功后达到 100%，以及请求失败后重试。首次登录平台/网络失败会进入本地模式，见下文离线回归。`npm run build:wechat` 也对真实构建产物执行场景回归。提审前仍需在微信开发者工具和 Android/iOS 真机上验证冷启动及断网恢复，并记录客户端版本、基础库版本和完整平台错误；本地测试不替代审核环境验证。

云端请求不再打开独立的连接弹窗。首页同步、开局与领奖在首页内容区展示状态；商店在原抽屉内展示，排行榜先展示榜单容器再加载内容。错误在原内容区点击重试，写请求继续复用持久化的请求 ID，不提前发放资产。启动同步完成前不展示占位金币和关卡进度，也不允许开局；设置和收藏说明仍可使用。关闭榜单会忽略该次请求的迟到结果，登录完成不会关闭用户正在查看的设置。

## 2026-11-10 移除微信用户资料功能

客户端不再获取、授权、上传或展示微信头像、昵称和好友关系，已移除对应入口、授权设置、好友成绩托管和开放数据域。世界榜仅展示匿名名、排名与关卡；云存档及游戏成绩继续使用既有账号识别和云函数。

云函数删除 `identity` 写入操作，榜单响应不再返回个人资料，数据库查询也不读取该字段。历史数据库资料不在本次本地改动中删除；新版本不会对外返回或展示。部署更新后的 `game` 云函数并更新客户端后，线上才能完整移除该功能；本地构建不会自动部署或发布。

构建脚本会删除旧构建目录中的开放数据域及其 `game.json` 配置，避免增量构建残留。客户端登录时会清除旧版本留在设备上的待重试资料上传，不再重放个人资料；其他待确认游戏操作仍按原流程重试。回归覆盖匿名榜单、旧资料不泄露、资料写入被拒绝、旧上传清理、分页与云存档恢复。

## 2026-11-13 离线可玩，联网功能保留

审核日志 `api can't use in offline mode` / `errCode: -9003` 对应云 API 平台失败。首次云登录遇到此类平台/网络失败、缺少云 SDK，或前台累计等待约 8 秒仍无响应，启动会切入本地模式；游戏资源加载仍必须完成，不用虚假的完成进度绕过资源错误。

本地模式复用已有选关、通关结算、解锁、奖励、金币商店和庭院逻辑，完整进度保存到 `pixel-garden-v1`。无历史本机存档时从第一关开始；不复制云端资产。本机速通榜可正常查看，离线成绩不上世界榜。正式广告位已配置时，本地模式提示广告暂不可用；当前空广告位仍保留已有的本地测试流程。

首页设置提供「存档：本机 / 云端」入口，切换前说明两份存档独立且当前关卡需重新开始。选择会保存在 `ant-play-mode`，以后打开沿用；网络恢复不会突然替换当前本机存档。主动使用云存档时重新登录既有云接口，恢复云端进度；登录失败回到本地模式。声音和音乐偏好使用设备设置，两种模式共用。

游戏过程中云请求网络失败仍可重试，另提供「离线游玩」入口，返回主页并读取独立的本机存档；未确认的云端消费、领奖和成绩不转换成本地结果。云请求约 8 秒无响应时可重新登录以重放原请求，或选择离线。迟到的请求不能覆盖已切换的存档，也不能清除后续云请求的持久化凭据。后端固定响应直接消费，业务拒绝（例如 VERSION、SESSION、COINS）保留原处理。

源码和真实微信构建产物均运行 `tests/offline-ui.test.mjs`，覆盖审核错误、首次无存档、网络失败、缺少云 SDK、登录超时、迟到回调、本地通关与奖励装修持久化、存档切换和待确认请求重放。仍需在微信开发者工具及审核对应真机 offline mode 下复验；本地构建不会部署或提审。
