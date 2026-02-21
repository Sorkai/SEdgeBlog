# 2026-02-22 Bootstrap 初始化

## 本次变更

- 拉取并保留参考地基代码：
  - `foundations/Blog-Astro`
  - `foundations/Talking-server`
- 初始化主站目录：将 Blog-Astro 基座迁移到 `apps/web`。
- 新增根工作区配置：
  - `package.json`
  - `pnpm-workspace.yaml`
- 新增构建前置脚本：
  - `scripts/fetch-base-data.mjs`
- 新增部署工作流：
  - `.github/workflows/deploy.yml`
  - 阶段：Setup / Fetch / Build / Deploy Cloudflare / Deploy EdgeOne
- 文档同步：
  - 更新 `docs/ARCHITECTURE.md`，新增“当前已落地初始化内容（2026-02-22）”

## 约束遵循说明

- 主站保持静态优先，未将动态 API 路由塞入 Astro。
- Base + Delta 流程先落地“构建期 Base 拉取”基础能力。
- 双边缘部署流程已具备骨架，后续补充项目级参数与认证细节。
