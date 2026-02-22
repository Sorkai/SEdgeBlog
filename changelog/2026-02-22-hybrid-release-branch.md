# 2026-02-22 混合发布方案切换

## 本次变更

- 发布策略由“Actions 直接双端部署”调整为“混合方案”：
  - GitHub Actions：执行前置数据拉取并同步发布分支
  - Cloudflare / EdgeOne：平台侧监听发布分支自动构建部署
- 更新工作流：
  - `.github/workflows/deploy.yml` 改为 `Prepare Release Branch`
  - 新增 `workflow_dispatch` 参数 `release_branch`（默认 `release-data`）
  - 同步逻辑：`git checkout -B <release_branch>` 并推送到远端
- 文档同步：
  - 更新 `docs/ARCHITECTURE.md` 第 8 节为混合方案说明
  - 更新 `.github/copilot-instructions.md` 的 GitHub Actions 约束

## 预期效果

- 前置数据生成统一在 GitHub Actions 执行，降低两平台构建输入差异。
- Cloudflare 与 EdgeOne 监听同一发布分支，保持部署来源一致。

## 后续操作

- 在 Cloudflare Pages / EdgeOne Pages 控制台将 Git 监听分支改为 `release-data`（或手动触发时指定的发布分支）。
