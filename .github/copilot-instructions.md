# SEdgeBlog Copilot Instructions

## 项目定位

这是一个基于 Astro 的“极致动静分离”边缘博客系统。

核心目标：
- 页面默认 100% 纯静态 HTML（首屏零非必要 JS）。
- 动态能力通过 Vue Islands 按需加载。
- 后端故障不影响文章阅读。
- 高频动态数据采用 Base + Delta 协议。
- 同时支持 Cloudflare Workers/KV 与 EdgeOne Functions/KV。

## 你在本仓库的行为规范（必须遵守）

1. 默认静态优先
- 优先使用 Astro SSG（`output: 'static'`）。
- 不要把动态 API 路由塞入 Astro 项目（除非用户明确要求改为 SSR/Hybrid）。

2. Islands 规则
- 交互组件必须是 Vue 3 组合式 API。
- 所有 Vue 组件必须显式声明水合策略：
  - 统计类（浏览量/点赞）：`client:load`
  - 评论区（页面底部）：`client:visible`

3. API 请求规则
- 所有前端请求必须使用相对路径，例如：`/api/v1/stats/${postId}`。
- 严禁在代码中硬编码域名、环境地址。

4. 容错规则
- 任何动态请求失败时，页面必须回退到可阅读状态。
- 文章内容渲染、目录、基础信息不可依赖动态接口成功。

5. 双边缘兼容
- `edge/cloudflare-worker` 与 `edge/edgeone-function` 实现同一份 API 契约。
- 如果运行时能力差异较大，优先保证契约一致，允许实现细节不同。

6. 架构文档
- 任何重要设计决策必须在 `docs/ARCHITECTURE.md` 中记录
- 文档必须清晰描述数据流、组件职责、协议细节。
- 任何变更必须同步更新文档。

7. 变更记录与文档同步（强制）
- 每次完整完成任务后，必须在 `changelog/` 新增对应变更记录。
- 若本文件（`.github/copilot-instructions.md`）内容有变更，需自动更新相应文档并同步修改说明。
- Go 后端相关变更需同步更新 `doc/` 目录下相应文档。
- 不同模块间的接口变更必须在双方文档中同步更新。
- 新增或修改功能时，务必更新相关文档，确保文档与代码一致。

## 强制协议：Base + Delta

### 数据定义

- Base：存储在核心中枢数据库（Go + Gin + SQLite/MySQL）
- Delta：存储在边缘 KV

KV 键设计：
- Key: `stats:{post_id}`
- Value: `{ "views_delta": number, "likes_delta": number }`

渲染公式：
- `display_value = base_value + delta_value`

### 构建阶段（Build-time）

- 在 `pnpm build` 前，执行脚本向 Go 中枢拉取全量 Base 数据。
- Base 数据写入前端可读取的数据文件（如 `apps/web/src/data/base-stats.json`）。
- Astro 在生成 HTML 时直接注入 Base。

### 在线阶段（Runtime）

- 用户访问或点赞只写边缘 Delta。
- 前端 Island 获取 Delta 并与 HTML 中 Base 合并显示。

### 收敛阶段（Cron）

- Go 服务每 6 小时（或阈值触发）收割 Delta。
- 执行 `Base = Base + Delta` 后清空边缘 Delta。
- 有变更时触发 GitHub Actions 重建。

## API 契约（边缘网关）

所有实现必须兼容以下接口：

1) `GET /api/v1/stats/:post_id`
- 返回：
```json
{ "post_id": "xxx", "views_delta": 15, "likes_delta": 3 }
```

2) `POST /api/v1/stats/:post_id/view`
- 行为：`views_delta` 原子 +1

3) `POST /api/v1/stats/:post_id/like`
- 行为：`likes_delta` 原子 +1

4) `POST /api/v1/comments`
- 行为：
  - 写入 `comments_queue`（KV）
  - 异步 webhook 投递至 Go 中枢

## Go 核心中枢职责

目录：`core/brain-api`

必须包含以下模块：
- Data Provider：给构建脚本提供 Base 数据（只读 API）
- Data Harvester：定时并发拉取 Cloudflare/EdgeOne Delta 与评论队列
- Build Trigger：调用 GitHub API 触发 workflow

建议技术：
- Web：Gin
- 定时：robfig/cron/v3
- DB：开发环境 SQLite，生产 MySQL

## GitHub Actions 约束

目标工作流：`.github/workflows/deploy.yml`

标准阶段顺序：
1. Setup（checkout、node、pnpm）
2. Fetch（拉取最新 Base 数据）
3. Build（`pnpm build`）
4. Deploy Cloudflare（`wrangler pages deploy ./dist`）
5. Deploy EdgeOne（`edgeone pages deploy` 或等价脚本）

Secrets 命名：
- `SERVER_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

## 目录约束

- 前端：`apps/web`
- 边缘 Cloudflare：`edge/cloudflare-worker`
- 边缘 EdgeOne：`edge/edgeone-function`
- 核心中枢：`core/brain-api`
- 构建脚本：`scripts`
- 架构文档：`docs`
- 参考源码：`foundations`（只读，不直接改造成生产主代码）

## 编码约束

- 优先最小改动，不重构无关模块。
- 不新增不必要依赖。
- 不在代码中写死密钥与域名。
- 变更接口时必须同步更新文档。
- 新增动态功能时，先定义契约再实现。

## 完成任务时的默认检查清单

每次提交实现前自检：
- 是否仍满足静态优先？
- 是否显式声明了 Island 水合策略？
- 是否全部使用相对路径 API？
- 动态失败时是否可回退？
- 是否兼容 Cloudflare 与 EdgeOne 契约？
- 是否更新了相关文档与脚本？

## 可参考的在线文档
- Astro 官方文档：https://docs.astro.build/
- Cloudflare Workers：https://developers.cloudflare.com/workers/
- EdgeOne Functions：https://pages.edgeone.ai/zh/document/pages-functions-overview
- EdgeOne: https://pages.edgeone.ai/zh/document/product-introduction
- edgeone有关Astro适配器的官方文档： https://pages.edgeone.ai/zh/document/framework-astro
- Cloudflare有关Astro适配器的官方文档：https://docs.astro.build/zh-cn/guides/integrations-guide/cloudflare/
你可以在实现过程中随时参考这些文档，确保你的实现符合官方推荐的最佳实践。
你也被允许查阅其他在线资源来解决实现过程中遇到的具体问题，但请确保最终实现符合上述所有约束和规范。