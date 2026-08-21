# dsh-simple-worktree

一个轻量的 Git Worktree 插件，用于 DeepSeek Harness。

**简体中文** · [English](README.md)

## 功能

- 从任意 Git Workspace 创建 Worktree。
- 支持当前分支和仓库主分支。
- 将新 Worktree 注册并打开为 DSH Workspace。
- 自动创建 `task/<name>` 格式的任务分支。
- 不需要额外服务或项目配置。
- 支持 DSH 主题、中文和英文界面。

## 使用

### 安装

```sh
dsh plugin --profile web add github:alpacachen/dsh-worktree
```

安装后重启 `dsh web`。

如果 pnpm 因 profile lockfile 中已有依赖报 `MINIMUM_RELEASE_AGE_VIOLATION`，请在命令末尾加上 `--config.minimum-release-age=0` 后重试。如果 pnpm 阻止 Git 包构建，请在 profile 的 `pnpm-workspace.yaml` 中将 `dsh-simple-worktree: true` 加到 `allowBuilds` 下，然后重试。

### 创建 Worktree

1. 打开一个 Git Workspace。
2. 打开 Workspace 菜单，选择 **创建 Worktree**。
3. 输入任务名称，例如 `login-fix`。
4. 选择 **当前分支** 或 **主分支**。
5. 点击 **创建并打开**。

Worktree 会创建在：

```text
project.worktrees/login-fix/
└── branch: task/login-fix
```

新 Workspace 的名称为 `<父 Workspace>/<任务名称>`。
