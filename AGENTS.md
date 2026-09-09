# inoForge Agent Instructions

## 目标与证据

- Forge 以 RISEMAP 的可观察业务行为为复制基线。页面、状态、字段和阻断规则应引用已保存证据；尚未在 RISEMAP 成功跑通的路径必须标为待复核实现。
- “完成”至少包含实现、相称的 API 验收、持久数据库停服重启回读，以及对用户可见关键页面的内置浏览器检查。单独的编译通过或接口健康不构成业务闭环。
- 不把测试夹具、调用方传入的库存数字或单进程状态描述成真实库存账、财务账或端到端验收。

## Git 与并行开发

- `main` 是集成分支。独立业务链使用 `codex/<scope>` 分支和独立 worktree；不要让多个 Agent 同时修改同一 worktree。
- 每个并行分支使用独立端口和独立 `.objectstack/*.sqlite`。验收时显式设置 `FORGE_URL`，禁止复用主线 `4310` 后宣称分支通过。
- 分支提交必须包含明确的实现边界和验证结果。主线逐个审查提交，解决共享 barrel、导航和 `package.json` 冲突，再统一运行门禁。
- 提交运行时数据库、`node_modules`、构建产物、环境文件、登录态或临时缓存是禁止的；证据截图和脱敏文本可以提交。

## Forge 门禁

在 `apps/forge-objectstack` 的每次元数据修改后运行：

```bash
pnpm typecheck
pnpm validate
pnpm build
```

再运行与本次业务链对应的验收脚本。涉及持久状态时，必须完整停服并从同一 SQLite 文件重启后回读。

