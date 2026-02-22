# SEdgeBlog 使用文档（当前项目版本）

本文面向当前仓库实际代码状态，覆盖：

- 本地开发与构建
- 本地联调（web / edge / core）
- GitHub Actions 部署
- 环境变量与 Secrets
- 常见问题排查

> 说明：当前项目处于“骨架可运行、业务持续完善”阶段。文档会明确区分“已可用流程”和“待补全能力”。

---

## 1. 项目结构与角色

- 前端主站：`apps/web`（Astro 静态站）
- Cloudflare 边缘网关：`edge/cloudflare-worker`
- EdgeOne 边缘网关：`edge/edgeone-function`
- Go 核心中枢：`core/brain-api`
- 构建前置脚本：`scripts/fetch-base-data.mjs`
- 自动化部署：`.github/workflows/deploy.yml`

---

## 2. 环境要求

## 2.1 必备工具

- Node.js `>=22`
- pnpm `>=10`
- Go `>=1.22`（仅 core 开发时需要）

## 2.2 可选工具

- wrangler（Cloudflare 本地调试/部署）
- edgeone CLI（EdgeOne 部署）

---

## 3. 快速开始（只跑前端）

在仓库根目录执行：

```bash
pnpm install
pnpm run fetch:base
pnpm --filter @sedge/web dev
```

访问开发地址（默认 Astro）：
- `http://localhost:4321`

### 3.1 预览构建产物

```bash
pnpm build
pnpm --filter @sedge/web preview
```

> 如果 `preview` 失败，通常是因为还没有构建产物，请先执行 `pnpm build`。

---

## 4. Base 数据拉取机制

脚本：`scripts/fetch-base-data.mjs`

行为：
- 优先请求：`$BRAIN_API_BASE_URL/api/v1/base-stats`
- 可选请求头：`x-api-key: $SERVER_API_KEY`
- 输出文件：`apps/web/src/data/base-stats.json`
- 若未配置 `BRAIN_API_BASE_URL` 或请求失败，会写入 fallback 空数据文件，不阻塞构建。

---

## 5. 本地联调（web + core + edge）

## 5.1 启动 Go 中枢

```bash
cd core/brain-api
go mod tidy
go run ./cmd/server
```

默认监听：`http://localhost:8080`

健康检查：
- `GET /healthz`

Base 数据接口：
- `GET /api/v1/base-stats`

环境变量：
- `PORT`：默认 `8080`
- `APP_ENV`：`development`/`production`
- `SERVER_API_KEY`：为空则不校验 `x-api-key`

## 5.2 启动 Cloudflare Worker 网关（本地）

```bash
cd edge/cloudflare-worker
pnpm install
pnpm dev
```

接口契约：
- `GET /api/v1/stats/:post_id`
- `POST /api/v1/stats/:post_id/view`
- `POST /api/v1/stats/:post_id/like`
- `POST /api/v1/comments`

部署前必须先改：`edge/cloudflare-worker/wrangler.toml`
- `STATS_KV` namespace id
- `COMMENTS_QUEUE` namespace id

## 5.3 EdgeOne 网关说明

目录：`edge/edgeone-function`

当前已实现同契约函数代码，但具体本地运行命令取决于你的 EdgeOne 工具链版本；建议先以 Cloudflare 路径完成联调，再按 EdgeOne 控制台/CLI 绑定：

- `STATS_KV`
- `COMMENTS_QUEUE`
- `WEBHOOK_URL`（可选）
- `WEBHOOK_TOKEN`（可选）

---

## 6. GitHub Actions 部署

工作流：`.github/workflows/deploy.yml`

触发方式：
- 推送到 `main`
- 手动 `workflow_dispatch`

阶段：
1. Setup（checkout/node/pnpm）
2. Fetch（拉 Base）
3. Build（构建 web）
4. Deploy Cloudflare Pages
5. Deploy EdgeOne Pages

## 6.1 必备 Secrets

- `CLOUDFLARE_API_TOKEN`
- `TENCENT_SECRET_ID`
- `TENCENT_SECRET_KEY`

## 6.2 建议配置的 Secrets

- `BRAIN_API_BASE_URL`
- `SERVER_API_KEY`

---

## 7. 常用命令速查

在仓库根目录：

- 安装依赖：`pnpm install`
- 前端开发：`pnpm dev`
- 拉 Base：`pnpm run fetch:base`
- 一键构建：`pnpm build`
- 预览构建：`pnpm --filter @sedge/web preview`

Cloudflare 网关目录：

- 本地调试：`pnpm dev`
- 部署：`pnpm deploy`

Go 中枢目录：

- 依赖整理：`go mod tidy`
- 启动：`go run ./cmd/server`
- 编译校验：`go test ./...`

---

## 8. 常见问题与排查

## 8.1 `pnpm --filter @sedge/web preview` 退出码 1

排查顺序：
1. 是否已先执行 `pnpm build`
2. 是否存在 `apps/web/dist`
3. 重新执行：
   - `pnpm --filter @sedge/web build`
   - `pnpm --filter @sedge/web preview`

## 8.2 构建时 Base 拉取失败

现象：控制台有 `fetch-base-data failed` 警告。

处理：
- 检查 `BRAIN_API_BASE_URL` 是否可访问
- 检查 `SERVER_API_KEY` 是否与中枢一致
- 即使失败也会生成 fallback 文件，不会阻塞构建

## 8.3 Cloudflare 部署失败（KV 相关）

检查：
- `wrangler.toml` 中的 namespace id 是否已替换
- `CLOUDFLARE_API_TOKEN` 权限是否包含 Pages/Workers/KV

## 8.4 Go 代码在编辑器报依赖缺失

先在 `core/brain-api` 下执行：

```bash
go mod tidy
go test ./...
```

`go test ./...` 通过可视为当前代码可编译。

---

## 9. 当前能力边界（请知悉）

当前版本已经可用于：
- 前端静态站构建与双线 Pages 发布
- 边缘网关 API 契约骨架验证
- Go 中枢骨架运行与接口联通

当前仍在完善：
- 前端 Vue Islands（`client:load` / `client:visible`）
- Base + Delta 页面展示闭环
- Go Data Harvester + Build Trigger 业务实装

建议下一步开发参照：
- `docs/DEVELOPMENT-GUIDE-2026-02-22.md`

---

## 10. 内容管理：如何管理文章

## 10.1 文章存放位置

- 目录：`apps/web/src/content/blog/`
- 当前按 `年/月` 组织，例如：`apps/web/src/content/blog/2026/02/*.md`

## 10.2 新建文章（推荐）

在仓库根执行：

```bash
pnpm --filter @sedge/web newpost "你的文章标题"
```

该命令会在 `apps/web/src/content/blog/{YYYY}/{MM}/` 下创建 `.md` 文件，并填入模板 frontmatter。

## 10.3 文章 frontmatter 字段说明

字段约束来自：`apps/web/src/content.config.ts`

- `title`：文章标题（必填）
- `date`：发布时间（必填，支持 `YYYY-MM-DD HH:mm:ss`）
- `updated`：更新时间（可选）
- `categories`：分类（必填）
- `tags`：标签数组（可选）
- `id`：文章唯一 id（必填，建议保持稳定）
- `cover`：封面图（可选）
- `recommend`：是否推荐（可选，`true/false`）
- `hide`：是否隐藏（可选，`true` 后不出现在列表）
- `top`：是否置顶（可选，`true` 时优先展示）

## 10.4 常见内容操作

- 发布新文章：新建 `.md` 后直接 `pnpm build`
- 修改旧文章：直接编辑原文件并重建
- 隐藏文章：frontmatter 里加 `hide: true`
- 置顶文章：frontmatter 里加 `top: true`
- 推荐文章：frontmatter 里加 `recommend: true`

## 10.5 图片与资源管理

- 文章内图片可以使用外链，也可放在 `apps/web/public/assets/images/` 下用相对路径引用
- 站点 banner 图常用目录：`apps/web/public/assets/images/banner/`

---

## 11. 站点信息管理：如何修改现有信息

主配置文件：`apps/web/src/config.ts`

## 11.1 基础站点信息

可直接修改以下字段：

- `Title`：站点名称
- `Site`：站点 URL
- `Subtitle`：副标题
- `Description`：SEO 描述
- `Author`、`Avatar`：作者信息
- `Motto`：座右铭
- `CreateTime`：建站时间

## 11.2 导航与侧边栏

- 顶部导航：`Navs`
- 侧边社交：`WebSites`
- 侧边栏模块开关：`AsideShow`

常见改法：
- 新增导航：在 `Navs` 增加 `{ text, link, icon, newWindow }`
- 下线模块：把 `AsideShow` 对应项改 `false`

## 11.3 主题与外观

- 主题变量：`Theme`
   - `--vh-main-color`
   - `--vh-font-color`
   - `--vh-main-radius`
   - `--vh-main-max-width`

修改后重启 dev 或重新 build 即可生效。

## 11.4 评论、统计、友链、说说等开关

- 评论系统：`Comment`（Twikoo/Waline/Artalk）
- 统计系统：`statistics.Umami`
- 友链数据源：`Link_conf`
- 说说数据源：`Talking_conf`
- Friends 数据源：`Friends_conf`
- SEO 推送：`SeoPush`

> 当前这些模块多数仍使用外部接口地址，若要遵循“前端统一相对路径 `/api/v1/*`”，建议按审计文档逐步改造。

---

## 12. 页面管理：如何修改现有页面

页面目录：`apps/web/src/pages/`

常见页面入口：

- 首页分页：`[...page].astro`
- 文章详情：`article/[...article].astro`
- 归档：`archives/index.astro`
- 分类：`categories/index.astro`、`categories/[...categories].astro`
- 标签：`tag/index.astro`、`tag/[...tag].astro`
- 友链：`links/index.md`
- 动态：`talking/index.md`
- 关于：`about/index.md`

修改规则：
- 内容说明页优先改 `.md`
- 结构与逻辑优先改 `.astro`

---

## 13. 功能模块管理：如何修改现有功能

## 13.1 组件层（UI 结构）

目录：`apps/web/src/components/`

常改组件：
- 页头页脚：`Header/`、`Footer/`
- 侧边栏：`Aside/`
- 评论框：`Comment/`
- 目录：`TableOfContents/`
- 轮播：`TalkingCarousel/`

## 13.2 脚本层（交互与请求）

目录：`apps/web/src/scripts/`

常改脚本：
- 初始化总入口：`Init.ts`
- 评论逻辑：`Comment.ts`
- 搜索：`Search.ts`
- 友链：`Links.ts`
- 动态：`Talking.ts`
- 主题切换：`Theme.ts`
- 浮动按钮：`FloatingButtons.ts`

## 13.3 样式层

- 全局：`apps/web/src/styles/Base.less`
- 文章样式：`Article.less`、`ArticleBase.less`
- 页面/模块样式：对应目录 `.less`

## 13.4 修改功能后的标准验证

每次改完建议最少执行：

```bash
pnpm --filter @sedge/web build
pnpm --filter @sedge/web preview
```

如果涉及 Go：

```bash
cd core/brain-api
go test ./...
```
