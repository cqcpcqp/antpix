# 版本管理

项目名称为 `antpix`，当前版本为 `0.2.0`。根目录 `package.json` 的 `version` 是项目版本的唯一来源，每个版本对应一个 Git 标签 `vX.Y.Z`。主分支为 `main`。

## 版本规则

采用语义化版本：修复问题升级 PATCH（例如 `0.1.1`），新增功能升级 MINOR（例如 `0.2.0`），达到正式稳定发布阶段时升级为 `1.0.0`。在 `0.x` 阶段，不兼容变更升级 MINOR，并在更新日志中说明。

项目版本与 Cocos 引擎版本、关卡目录/存档版本、云函数 npm 包版本分别管理。不要为了升级项目版本修改存档迁移标识或工具配置格式版本。

## 日常提交

```sh
git status
git add <本次修改的文件>
git commit -m "fix: 描述本次修复"
```

保留素材源文件和 Cocos `.meta`。缓存、临时文件、构建产物、依赖及本地配置由 `.gitignore` 排除。

## 创建下一版本

1. 将 `CHANGELOG.md` 中 `Unreleased` 的变更整理到新版本标题下，填写发布日期，并保留空的 `Unreleased`。
2. 提交本次代码与更新日志，确保工作区干净。
3. 在根目录执行以下命令之一：

```sh
npm version patch -m "chore(release): v%s"
# 或新增功能时：
npm version minor -m "chore(release): v%s"
# 或指定版本时：
npm version 1.0.0 -m "chore(release): v%s"
```

`npm version` 会先通过 `preversion` 执行 `npm run check`；检查失败时停止升级。成功后更新 `package.json`、创建版本提交和 Git 标签。请勿使用 `--force` 绕过脏工作区检查。

```sh
git log -1 --oneline
git describe --tags --exact-match
```

已配置 `origin` 远程仓库。发布版本时推送代码与对应标签：

```sh
git push origin main
git push origin v0.2.0
```

创建标签只记录源码版本，不会自动部署云函数、上传微信小游戏或完成真机验收。
