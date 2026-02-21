# 2026-02-22 CSS 兼容性修复与 tsconfig 诊断

## 变更摘要

- 批量修复 `apps/web` 多个 LESS 文件中的 Safari / iOS Safari 兼容告警：
  - 为 `user-select` 补充 `-webkit-user-select`
  - 为 `backdrop-filter` 补充 `-webkit-backdrop-filter`
- 统一前缀声明顺序，消除 `css-prefix-order` 告警：
  - `-webkit-backdrop-filter` 在前，`backdrop-filter` 在后
  - `-webkit-background-clip` 在前，`background-clip` 在后
  - 光标顺序改为 `-webkit-zoom-in` → `-moz-zoom-in` → `zoom-in`

## 诊断结果

- `apps/web/tsconfig.json` 的 `extends: "astro/tsconfigs/strict"` 仍出现编辑器报错时，已确认并非配置写法问题。
- 在工作区中已可解析该路径（依赖安装后可通过 Node 解析），当前更可能是 TypeScript Server / 诊断缓存未刷新导致。
- `schemastore` 访问失败属于网络或 TLS 连接问题，不是仓库代码错误。

## 建议

- 执行并确认：`pnpm install`（已执行）
- 若编辑器仍提示找不到 `astro/tsconfigs/strict`：重启 TypeScript Server 或重载 VS Code 窗口后复查。
