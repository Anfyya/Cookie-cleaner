# 变更日志

## v0.1 | 2026-03-29 17:42
- 变更摘要：初始化本地 Git 仓库，接入目标远端仓库，并合并远端已有的 `README.md` 历史以准备完整上传当前扩展源码。
- 涉及文件：`README.md`、`CHANGELOG.md`
- 原因：目标仓库 `Anfyya/Cookie-cleaner` 的 `main` 分支已存在独立初始提交，直接推送会被拒绝，需要先合并远端历史并保留本地文件。
- 如何部署更改：已在本地执行 `git remote add origin https://github.com/Anfyya/Cookie-cleaner.git` 与 `git merge origin/main --allow-unrelated-histories`；同步到远端使用 `git push -u origin main`。
