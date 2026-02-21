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

### 继续推进（同日）

- 新增 `edge/cloudflare-worker` 最小可运行网关：
  - `GET /api/v1/stats/:post_id`
  - `POST /api/v1/stats/:post_id/view`
  - `POST /api/v1/stats/:post_id/like`
  - `POST /api/v1/comments`
- 新增 `edge/edgeone-function` 同契约网关骨架，保证双边缘接口一致。
- 新增 `core/brain-api` Go + Gin 骨架：
  - `GET /healthz`
  - `GET /api/v1/base-stats`（`x-api-key`）
  - `POST /internal/harvest/manual`（stub）
  - `robfig/cron` 6 小时占位任务
- 新增各模块说明文件：
  - `edge/cloudflare-worker/README.md`
  - `edge/edgeone-function/README.md`
  - `core/brain-api/README.md`

## 约束遵循说明

- 主站保持静态优先，未将动态 API 路由塞入 Astro。
- Base + Delta 流程先落地“构建期 Base 拉取”基础能力。
- 双边缘部署流程已具备骨架，后续补充项目级参数与认证细节。
- 双边缘网关已按同一 API 契约实现，后续聚焦 KV 收割与中枢收敛逻辑。
