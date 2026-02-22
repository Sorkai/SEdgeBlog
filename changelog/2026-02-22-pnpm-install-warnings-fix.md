# 2026-02-22 pnpm install 告警修复

## 变更摘要

- 修复根工作区 `packageManager` 版本声明：
  - 从 `pnpm@10` 调整为 `pnpm@10.30.1`，消除 `Cannot switch to pnpm@10` 告警。
- 迁移 `pnpm.onlyBuiltDependencies` 到工作区根：
  - 在根 `package.json` 新增统一配置。
  - 移除 `apps/web/package.json` 中无效的同名字段，消除“子包配置不生效”告警。
- 修复 `artalk` 的 peer 依赖告警：
  - 在 `apps/web` 显式添加 `marked@^14.1.4` 以满足 `artalk@2.9.1` 的 peer 要求。
- 移除未使用且已废弃依赖：
  - 删除 `apps/web` 的 `intersection-observer`。

## 影响范围

- `package.json`
- `apps/web/package.json`
- `docs/ARCHITECTURE.md`

## 验证建议

- 在仓库根执行：`pnpm install`
- 预期：上述三类可修复告警消失；若仍有 transitive deprecated 提示，属于上游包链路信息，不影响当前功能。
