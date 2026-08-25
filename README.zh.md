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
dsh plugin --profile web add @alpacachen/dsh-simple-worktree
```

安装后重启 `dsh web`。

也可以通过 GitHub 安装：`dsh plugin --profile web add github:alpacachen/dsh-worktree`。

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
