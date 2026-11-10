# 微信云开发

当前版本使用 `game` 云函数提供 100 关配置、存档、金币结算、庭院装修和排行榜。微信客户端直接消费固定响应契约，不添加后台返回兜底。

## 更新部署

先执行 `npm run prepare:cloud` 和本地回归，再部署。微信开发者工具需登录并开启服务端口；从项目根目录执行：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy --env cloudbase-d9glil4qk6b5865ba --names game --remote-npm-install --project "$PWD"
```

云端配置曾于 2026-10-10 部署核验；此记录不代表后续本地修改已自动部署。部署后需核对函数状态及客户端登录、购买和存档恢复。

2026-10-14 已同步部署最新 100 关配置，并修正最低耗时下限：按 9 槽、全程 4× 的保守最快情况计算，扣除每个容器首次立即派出的蚂蚁，忽略行走和入槽耗时，保留 2 秒余量。第 17 关允许 90/94 次投放，最低耗时约 36.69 秒。部署后函数状态为 Active，下载的 6 个云端文件与本地逐字节一致；相关 20 项本地测试通过，真机通关仍需验证。

2026-10-15 已部署排行榜头像昵称与授权修复对应的 `game` 云函数到 `cloudbase-d9glil4qk6b5865ba`。部署状态为 Active，下载的 6 个业务/配置文件与本地逐字节一致；部署前 16 项云端测试通过。客户端真机授权、头像显示和后台隐私声明由用户继续验证。

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
- 世界榜展示前 100 名，每页 10 人：最高通关关卡降序、首次达成服务器时间升序；毫秒相同时按内部 ID 排序以保持稳定。未通关不上榜，默认使用随机匿名玩家名；玩家可主动授权微信头像昵称并公开展示，也可恢复匿名。
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
| identity    | nickname、avatarUrl（同时为 null 表示恢复匿名）      | 保存当前玩家公开头像昵称       |
| leaderboard | page（0–9）                                          | 读取世界榜                     |

存档成功响应：`{ok:true, profile, day, serverTime, adViews, highest, reachedAt, output}`。`output` 按操作返回 `userId/runId/adId/amount/purchase`；无额外结果时为空对象。榜单响应：`{ok:true, rows, hasNext}`。业务拒绝：`{ok:false, code, message}`；网络或平台故障由调用 Promise 抛出。客户端严格消费约定字段，不猜测字段、不填默认值。

## 好友榜与广告

好友榜使用 `wx.setUserCloudStorage` 镜像已接受的最高成绩；`wechat/open-data/index.js` 在开放数据域调用 `wx.getFriendCloudStorage`，按同样规则排序。数据 key 为 `ant-progress-v4`。通过 `SubContextView` 渲染，主域不读取或上传好友名单。查看时先调用 `wx.requirePrivacyAuthorize` 使用官方隐私弹窗，再通过 `wx.getSetting` 判断 `scope.WxFriendInteraction`：未请求过才调用 `wx.authorize`，明确拒绝时展示“打开授权设置”按钮，用户点击后直接调用 `wx.openSetting`。隐私配置失败、隐私拒绝、好友权限拒绝与其他平台错误分别处理，原始 `errno/errMsg` 保留在控制台。构建脚本复制开放数据域并写入 `game.json.openDataContext`。昵称由开放数据域使用系统字体绘制，头像通过该域的 `wx.createImage` 加载。刷新后忽略旧请求和旧头像回调，好友数据不传入主域。

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

## 2026-10-15 排行榜授权与头像昵称

定位确认：旧实现丢弃 `wx.authorize.fail` 原始错误，将所有失败误报为“请在微信设置中允许好友互动权限”。截图无法恢复当时的原始平台错误，因此不能据此断言玩家拒绝过授权。新版记录原始错误并显式区分状态；首次授权、明确拒绝、重新打开设置和隐私失败均有自动化覆盖。

世界榜新增固定响应字段 `rows[].identity`，类型为 `{nickname: string, avatarUrl: string} | null`。`null` 明确表示未公开资料，客户端按这个业务状态展示匿名名，不做字段缺失兜底。历史数据库记录尚无 `identity` 字段时，服务端在构造固定响应时迁移为 `null`；新玩家明确保存 `null`。原始微信用户 ID 不随榜单返回。

“微信头像昵称”入口先请求隐私授权，再创建微信原生 `wx.createUserInfoButton`。用户主动点击成功后，使用既有幂等写入流程提交 `identity` 操作，只修改当前登录账号的公开资料；“恢复匿名”清除公开资料。世界榜昵称使用系统字体以支持任意玩家昵称。远程头像回调检查页面有效性，关闭页面释放纹理和图片引用，原生授权按钮随页面销毁。

更新前须完成：

1. 在小游戏 MP 后台《用户隐私保护指引》声明“微信朋友关系”（好友榜/成绩托管）及“昵称、头像”（世界榜公开展示），配置用途并完成平台要求的生效流程。使用微信官方隐私弹窗，基础库需支持 `wx.requirePrivacyAuthorize`。这属于后台配置，仓库修改无法代办。
2. 先部署新的 `game` 云函数，再运行新客户端；新增客户端严格依赖新的固定字段及 `identity` 操作。旧客户端可继续忽略新增字段。
3. 真机验证首次同意/拒绝隐私指引、首次好友授权、拒绝后从按钮进入设置、同意后显示头像昵称，以及世界榜授权/恢复匿名。核对头像下载域名配置允许实际返回的微信头像域名。
4. 如果仍失败，控制台查找 `WeChat privacy authorization failed`、`WeChat friend permission failed` 或 `Friend cloud storage failed`。官方列出的 `112`、`1025/1026` 属于隐私声明配置问题，`104` 表示隐私授权未完成；其他错误保留原文用于定位，不能当作好友权限拒绝。

参考：

- https://developers.weixin.qq.com/minigame/dev/guide/base-ability/authorize.html
- https://developers.weixin.qq.com/minigame/dev/guide/open-ability/privacy.html
- https://developers.weixin.qq.com/minigame/dev/guide/open-ability/user-info.html
- https://developers.weixin.qq.com/minigame/dev/api/open-api/user-info/wx.createUserInfoButton.html
