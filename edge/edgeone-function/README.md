# EdgeOne Function 网关骨架

当前实现与 Cloudflare Worker 对齐同一份 API 契约：

- `GET /api/v1/stats/:post_id`
- `POST /api/v1/stats/:post_id/view`
- `POST /api/v1/stats/:post_id/like`
- `POST /api/v1/comments`

运行时需要提供绑定：

- `STATS_KV`
- `COMMENTS_QUEUE`
- `WEBHOOK_URL`（可选）
- `WEBHOOK_TOKEN`（可选）
