# Cloudflare Worker 网关骨架

当前实现 API 契约：

- `GET /api/v1/stats/:post_id`
- `POST /api/v1/stats/:post_id/view`
- `POST /api/v1/stats/:post_id/like`
- `POST /api/v1/comments`

## 本地开发

- `pnpm i`
- `pnpm dev`

## 部署

- 在 `wrangler.toml` 中替换 KV namespace id
- 执行 `pnpm deploy`
