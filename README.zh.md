<div align="center">

# dsh-simple-worktree

### DeepSeek Harness 中的轻量 Git Worktree 小工具。

一个菜单，一个弹窗，一个隔离 Workspace。

**简体中文** · [English](README.md)

</div>

## 为什么使用它？

`dsh-simple-worktree` 只做一件事：创建 Git Worktree，并将它打开为 DSH Workspace。

- **小而专注**：没有看板、工作流或额外的项目管理层。
- **无需额外服务**：直接使用 Git 和 DSH 现有的 Workspace 能力。
- **无需配置**：选择分支、输入名称，然后开始工作。
- **原生体验**：跟随 DSH 的主题和语言设置。

## 🚀 开始使用

### 安装

```sh
dsh plugin --profile web add github:alpacachen/dsh-worktree
```

安装后重启 `dsh web`。

### 创建 Worktree

1. 打开一个 Git Workspace。
2. 在 Workspace 菜单中选择 **创建 Worktree**。
3. 输入任务名称，例如 `login-fix`。
4. 选择 **当前分支** 或 **主分支**。
5. 点击 **创建并打开**。

插件会创建并打开：

```text
project.worktrees/login-fix/
└── branch: task/login-fix
```

新 Workspace 会命名为 `<父 Workspace>/<任务名称>`，可以直接开始独立对话。

## 保持简单

- 一个轻量弹窗，不引入新的工作流。
- 每个任务一个 Git 分支：`task/<name>`。
- 不影响已有 Workspace 和对话。
- 支持中文和英文界面。
