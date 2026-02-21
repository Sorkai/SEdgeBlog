# brain-api（Go + Gin）

当前是核心中枢最小骨架，已包含：

- `GET /healthz`
- `GET /api/v1/base-stats`（支持 `x-api-key`）
- `POST /internal/harvest/manual`（stub）
- `robfig/cron` 每 6 小时调度占位任务

## 本地启动

```bash
cd core/brain-api
go mod tidy
go run ./cmd/server
```

可选环境变量：

- `PORT`（默认 `8080`）
- `APP_ENV`（`development|production`）
- `SERVER_API_KEY`（为空时不校验）
