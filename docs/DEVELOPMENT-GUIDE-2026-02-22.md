# SEdgeBlog 后续开发指导（审计版）

## 1. 目的与范围

本文件用于回答：**当前实现距离目标架构还差什么、先改什么、如何验收**。

审计依据：
- 项目约束文档 [.github/copilot-instructions.md](.github/copilot-instructions.md)
- 架构文档 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 当前代码实现（`apps/web`、`edge/*`、`core/brain-api`、workflow）

---

## 2. 审计总览（挡墙状态）

### 2.1 已达成（可继续迭代）

- 主仓目录结构已建立：`apps/web`、`edge/cloudflare-worker`、`edge/edgeone-function`、`core/brain-api`。
- 双边缘 API 契约骨架已落地（4 个接口）：
  - [edge/cloudflare-worker/src/index.ts](edge/cloudflare-worker/src/index.ts)
  - [edge/edgeone-function/src/index.ts](edge/edgeone-function/src/index.ts)
- Go 中枢骨架已可编译运行（health/base-stats/manual-harvest stub）：
  - [core/brain-api/internal/http/router.go](core/brain-api/internal/http/router.go)
  - [core/brain-api/internal/harvester/scheduler.go](core/brain-api/internal/harvester/scheduler.go)
- 构建前拉取 Base 数据脚本已存在：
  - [scripts/fetch-base-data.mjs](scripts/fetch-base-data.mjs)
- CI 基础流程已存在（Setup/Fetch/Build/双线 Pages 部署）：
  - [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

### 2.2 核心差距（当前挡墙）

1. **前端未完成 Vue Islands 化（P0）**
   - 未发现 `.vue` 组件，也未发现 `client:load` / `client:visible` 水合声明。
   - 文章页仍以旧评论脚本方式工作，统计/点赞未接入边缘契约。

2. **Base + Delta 未闭环（P0）**
   - `base-stats.json` 被生成，但前端未消费：未发现 `views_base` / `likes_base` 注入与合并渲染。
   - `display = base + delta` 尚未在页面层落地。

3. **前端运行时请求未统一相对路径（P0）**
   - 存在硬编码外部请求入口（配置/API脚本）例如：
     - [apps/web/src/config.ts](apps/web/src/config.ts)
     - [apps/web/src/scripts/Comment.ts](apps/web/src/scripts/Comment.ts)
     - [apps/web/src/scripts/Friends.ts](apps/web/src/scripts/Friends.ts)
     - [apps/web/src/scripts/Talking.ts](apps/web/src/scripts/Talking.ts)
     - [apps/web/src/scripts/Music.ts](apps/web/src/scripts/Music.ts)
   - 与“前端请求必须 `/api/v1/*` 相对路径”约束不一致。

4. **Go 中枢三大职责未完成（P0）**
   - Data Provider 仅空数据 stub。
   - Data Harvester 仅定时日志，不拉取双边缘 Delta/评论队列。
   - Build Trigger 未实现（未调用 GitHub API）。

5. **边缘写增量未做并发安全策略（P1）**
   - 当前为读改写，未实现严格原子/版本控制重试。
   - 高并发下可能丢增量。

6. **静态优先配置未显式固化（P1）**
   - [apps/web/astro.config.mjs](apps/web/astro.config.mjs) 未显式声明 `output: 'static'`。

7. **core 未纳入统一工作区与自动化（P2）**
   - 根工作区未包含 `core/*`，Go 相关检查未进入 CI。

---

## 3. 建议开发顺序（强执行优先级）

## P0（本周必须完成）

### P0-1：前端 Islands 最小闭环（统计 + 评论）

目标：严格符合约束。

实施点：
- 新增 Vue3 组件：
  - `StatsIsland.vue`（浏览/点赞，`client:load`）
  - `CommentsIsland.vue`（评论区，`client:visible`）
- 文章页挂载（仅文章页）：
  - [apps/web/src/pages/article/[...article].astro](apps/web/src/pages/article/[...article].astro)

验收：
- 页面源码含 Base 值（HTML 可见）。
- 运行后动态叠加 Delta，接口失败时页面仍可读。
- 明确看到 `client:load` 与 `client:visible`。

### P0-2：相对路径 API 治理

目标：把“前端运行时请求”统一到 `/api/v1/*`。

实施点：
- 新建统一客户端：`apps/web/src/lib/api.ts`（仅相对路径）
- 将 `scripts/*` 中运行时网络请求迁移到相对路径入口。
- 外链内容（文章链接）可保留绝对 URL，不属于运行时 API。

验收：
- 代码搜索中，前端运行时 `fetch` 目标不再出现业务域名。
- 请求入口清晰、可切换边缘网关。

### P0-3：Go 中枢最小业务闭环

目标：实现 Data Provider + Harvester + Build Trigger MVP。

实施点：
- Data Provider：`GET /api/v1/base-stats` 返回真实数据结构。
- Harvester：
  - 拉取 Cloudflare/EdgeOne `stats delta`
  - 合并写回 Base
  - 清零边缘 Delta（新增边缘管理端点或内部能力）
- Build Trigger：调用 GitHub Actions Workflow Dispatch。

建议文件落点：
- `core/brain-api/internal/provider/*`
- `core/brain-api/internal/harvester/*`
- `core/brain-api/internal/trigger/*`

验收：
- 手动触发收割后，Base 增长且 Delta 清零。
- 成功触发一次工作流重建。

---

## P1（P0 后立即跟进）

### P1-1：边缘并发安全与幂等

目标：减少高并发丢计数风险。

建议：
- Cloudflare 优先考虑 Durable Object 计数或 KV CAS 风格重试。
- EdgeOne 侧提供等价策略（契约一致，细节可不同）。
- 评论 webhook 增加重试与失败记录。

验收：
- 压测下计数单调增加且偏差在可接受范围。

### P1-2：显式静态优先

实施：
- [apps/web/astro.config.mjs](apps/web/astro.config.mjs) 增加 `output: 'static'`。

验收：
- 构建产物保持纯静态，无 Astro API 路由依赖。

### P1-3：文档分层

新增：
- `docs/API-CONTRACT.md`（边缘契约）
- `docs/RUNBOOK.md`（收割/回滚/故障）
- `docs/ROADMAP.md`（里程碑）

---

## P2（稳定化）

- 把 `core/brain-api` 的检查加入 CI（`go test ./...`）。
- 根 workspace 补充 `core/*` 的开发入口说明。
- 引入最小观测：收割日志、重建触发日志、失败告警出口。

---

## 4. 里程碑计划（建议）

### M1（2~3 天）
- 完成 P0-1 + P0-2。
- 文章页实现 Base+Delta 前端闭环。

### M2（2~4 天）
- 完成 P0-3（中枢收割+触发）。
- 打通“访问 -> Delta -> 收割 -> 重建 -> 新 Base”。

### M3（2~3 天）
- 完成 P1（并发安全、静态显式、文档分层）。

---

## 5. DoD（完成定义）

满足以下全部才算进入“可用版本”：

- 前端动态能力仅通过 Vue Islands，且水合策略符合约束。
- 所有前端运行时 API 请求均为 `/api/v1/*` 相对路径。
- Base + Delta 显示公式在线上生效，接口失败不影响阅读。
- Go 中枢具备 Provider/Harvester/Trigger 三职责最小可用实现。
- 双边缘契约一致并有最小并发安全策略。
- 文档与 `changelog/` 同步。

---

## 6. 推荐下一步（直接开工）

1) 先做 `StatsIsland.vue` + 文章页接入 + `/api/v1/stats/:post_id` 调用。  
2) 再做 `CommentsIsland.vue`（`client:visible`）替换现有评论挂载方式。  
3) 最后推进 Go 收割与 Workflow Trigger，打通全链路。
