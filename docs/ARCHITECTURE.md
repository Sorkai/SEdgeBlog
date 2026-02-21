# SEdgeBlog 架构设计（Astro + Edge + Go）

## 1. 目标与原则

- 前端页面默认必须为纯静态 HTML（SSG），首屏不注入非必要 JS。
- 动态能力仅通过 Astro Islands + Vue 组件按需水合。
- 后端不可用时，文章阅读必须不受影响（静态可读性优先）。
- 高频计数数据统一采用 Base + Delta 模型。
- 同时支持 Cloudflare 与腾讯云 EdgeOne 两条边缘链路。

## 2. 基础项目来源与复用策略

### 2.1 Blog-Astro（前端基座）

来源：`foundations/Blog-Astro`

可复用：
- Astro 内容组织（`src/content`、`src/pages/article`）
- 主题与布局体系（Layout / PageLayout）
- 文章渲染与 SSG 路由生成方式

改造方向：
- 新增 Vue Islands：`StatsIsland`、`LikeIsland`、`CommentsIsland`
- 文章页注入静态 Base 值，客户端仅拉 Delta
- 所有动态请求统一使用相对路径 `/api/v1/*`

### 2.2 Talking-server（边缘数据思路参考）

来源：`foundations/Talking-server`

现状：
- Cloudflare Workers + KV + R2 的 JS 项目
- 提供了 KV 读写与轻 API 处理参考

改造方向：
- 抽象成“边缘网关层”能力模板
- 按本方案重建 API 契约（stats/comment queue/webhook）

## 3. 目标目录结构（Monorepo）

```text
SEdgeBlog/
├─ apps/
│  └─ web/                           # Astro 前端（主站）
├─ edge/
│  ├─ cloudflare-worker/             # Cloudflare 边缘网关 + KV
│  │  └─ src/
│  └─ edgeone-function/              # EdgeOne 边缘函数 + KV
│     └─ src/
├─ core/
│  └─ brain-api/                     # Go + Gin 核心中枢
│     ├─ cmd/server/
│     └─ internal/
├─ scripts/                          # 构建前置拉取、部署辅助脚本
├─ docs/                             # 架构、接口、运维文档
├─ foundations/                      # 参考地基源码（只读）
│  ├─ Blog-Astro/
│  └─ Talking-server/
└─ .github/
   ├─ copilot-instructions.md
   └─ workflows/
```

## 4. Base + Delta 协议（强约束）

### 4.1 数据定义

- Base：核心中枢数据库中的稳定值（`views_base`, `likes_base`）
- Delta：边缘 KV 中实时增量（`views_delta`, `likes_delta`）

KV 结构：
- Key: `stats:{post_id}`
- Value: `{ "views_delta": 15, "likes_delta": 3 }`

### 4.2 渲染公式

`客户端展示值 = HTML 预置 Base + 边缘 API 返回 Delta`

### 4.3 构建与收敛

- 构建阶段：Astro build 前，脚本向 Go 中枢拉取全量 Base 并落盘到本地数据文件。
- 在线阶段：用户访问/点赞仅写边缘 Delta。
- 收敛阶段（每 6h 或阈值触发）：Go 中枢聚合 Delta -> 更新 Base -> 清空 Delta -> 触发重建。

## 5. 前端层设计（Astro + Vue）

### 5.1 页面渲染策略

- 默认 `.astro` + SSG。
- 非必要页面不使用 SSR。
- 动态组件均为 Island：
  - 浏览量/点赞数据组件：`client:load`
  - 评论组件：`client:visible`

### 5.2 数据注入

- 文章构建时把 `views_base`、`likes_base` 注入页面（frontmatter 或生成数据映射）。
- 页面仅请求 `/api/v1/stats/:post_id` 获取 Delta。

### 5.3 API 约束

- 必须使用相对路径，例如 `/api/v1/stats/${postId}`。
- 严禁在组件中硬编码域名。

## 6. 边缘网关层设计（Cloudflare + EdgeOne）

职责：
- 仅处理 `/api/*`，执行 KV 读写，返回 JSON。
- 无业务重逻辑，不耦合前端模板。

### 6.1 核心 API 契约

1) `GET /api/v1/stats/:post_id`
- 读取 KV Delta
- 返回：
```json
{ "post_id": "xxx", "views_delta": 15, "likes_delta": 3 }
```

2) `POST /api/v1/stats/:post_id/view`
- 对 `views_delta` 原子 +1（尽量使用平台原子能力；若无，使用乐观重试 CAS）

3) `POST /api/v1/stats/:post_id/like`
- 对 `likes_delta` 原子 +1（同上）

4) `POST /api/v1/comments`
- 写入 `comments_queue:{id}`（或列表聚合键）
- 异步 Webhook 投递给 Go 中枢

### 6.2 双平台实现建议

- 方案 A：共享协议层 + 双运行时适配器
- 方案 B：分别维护两套极简脚本（推荐先 A，若差异过大回退 B）

## 7. 核心中枢（Go + Gin）

### 7.1 模块职责

- Data Provider：提供构建期 Base 数据只读 API
- Data Harvester：定时聚合 Delta + 评论队列
- Build Trigger：调用 GitHub API 触发重建

### 7.2 定时任务

- 使用 `robfig/cron/v3`
- 调度策略：`@every 6h`（可配置）
- 并发拉取 Cloudflare 与 EdgeOne Delta
- 幂等更新 Base：`base = base + delta`
- 成功后调用边缘管理 API 清零 Delta

### 7.3 数据库建议

- 本地/单机：SQLite（快速启动）
- 生产：MySQL（可观测与备份更好）

建议核心表：
- `posts(id, slug, title, views_base, likes_base, updated_at)`
- `comments(id, post_id, content, author, status, created_at)`
- `harvest_logs(id, source, scanned, merged, reset_ok, created_at)`

## 8. GitHub Actions 双线部署

目标工作流：`.github/workflows/deploy.yml`

阶段：
1. Setup
- checkout + Node + pnpm

2. Fetch
- 执行 `scripts/fetch-base-data.*`
- 携带 `SERVER_API_KEY` 调 Go 中枢

3. Build
- `pnpm build` 产出纯静态 `dist`

4. Deploy-Cloudflare
- `wrangler pages deploy ./dist`
- Secret: `CLOUDFLARE_API_TOKEN`

5. Deploy-EdgeOne
- `edgeone pages deploy` 或官方 CLI 脚本
- Secrets: `TENCENT_SECRET_ID`, `TENCENT_SECRET_KEY`

## 9. Astro 适配器与模式约束

- 主站原则：`output: 'static'`
- 仅当确实需要 Astro 内置 API 路由时，才切到 server/hybrid。
- Cloudflare 文档明确：纯静态站点不必启用 `@astrojs/cloudflare`。
- EdgeOne 文档明确：SSG 下不可使用服务端路由（`src/pages/api/*`）。

因此本方案采用：
- 主站保持 SSG
- 动态 API 独立放在 `edge/*`，不塞进 Astro 项目内部

## 10. 实施里程碑（建议）

M1：目录与规范
- 完成 monorepo 目录、Copilot 规则、基础脚手架

M2：前端 Island 化
- 完成 Stats/Like/Comments 三组件 + 相对路径调用

M3：双边缘 API
- Cloudflare 与 EdgeOne 的 stats/comment API 上线

M4：Go 中枢
- Base 提供、Cron 聚合、KV 清零、Build Trigger 打通

M5：CI/CD
- Deploy 工作流完成双线发布与回滚策略

## 11. 风险与预案

- KV 最终一致性导致短时间跨区域读差异：前端显示允许秒级抖动。
- 双平台 API 差异：先收敛协议，再在运行时适配。
- 触发重建频率过高：加入阈值触发和去抖（最短间隔）。
- 评论 webhook 失败：队列保留 + 重试 + 死信标记。

## 12. 当前已落地初始化内容（2026-02-22）

- 已完成 `apps/web` 的前端基座迁移（来源于 `foundations/Blog-Astro`，排除了仓库元数据目录）。
- 已建立根工作区：`package.json` + `pnpm-workspace.yaml`，支持从仓库根运行构建命令。
- 已创建构建前置脚本：`scripts/fetch-base-data.mjs`，默认拉取 `GET /api/v1/base-stats` 并写入 `apps/web/src/data/base-stats.json`。
- 已创建 CI/CD：`.github/workflows/deploy.yml`，包含 `Fetch -> Build -> Deploy Cloudflare -> Deploy EdgeOne` 的双线流程。
- 已建立 `changelog/` 目录并要求后续任务持续记录变更。


---

Custom Instructions for Copilot：
All responses, including PR summaries, overviews, and code review comments, must be in Simplified Chinese (简体中文).
Keep the technical terms (like bcrypt, MD5, async) in English where appropriate, but explain the logic in Chinese.