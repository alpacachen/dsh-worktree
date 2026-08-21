<div align="center">

# dsh-worktree

### 在 DeepSeek Harness 中管理并行 Git 工作区。

无需离开 DSH，即可创建隔离的 Git Worktree。

**简体中文** · [English](README.md)

</div>

## ✨ 功能

| 创建 | 隔离 | 保持在 DSH 中 |
| --- | --- | --- |
| 从任意 Git Workspace 创建 Worktree。 | 每个任务拥有独立目录和分支。 | 新 Worktree 会注册并打开为 DSH Workspace。 |
| 支持当前分支或仓库默认分支。 | 分支格式为 `task/<name>`。 | 原有对话和 Workspace 保持不变。 |

- 支持中文和英文界面。
- 跟随 DSH 的浅色/深色主题和语言设置。
- 删除 Worktree Workspace 时会删除 Git Worktree，但对话会保留在 **未分组** 中。

## 🚀 开始使用

### 1. 安装

```sh
dsh plugin --profile web add github:alpacachen/dsh-worktree
```

重启 `dsh web`，使插件 bundle 生效。

### 2. 创建 Worktree

1. 打开一个 Git Workspace。
2. 打开 Workspace 菜单，选择 **创建 Worktree**。
3. 输入任务名称，例如 `login-fix`。
4. 选择基于：
   - **当前分支**：当前 Workspace 所在的分支。
   - **主分支**：仓库默认分支。
5. 点击 **创建并打开**。

创建后的结构如下：

```text
project/                         # 原 Workspace
project.worktrees/login-fix/     # 新 Workspace
└── branch: task/login-fix
```

## 🌿 分支选择

插件按以下顺序识别主分支：

1. `origin/HEAD`，例如 `origin/main`。
2. 已存在的 `main`、`master`、`trunk` 或 `develop` 分支。
3. 最后回退到仓库的主 Worktree 分支。

当前分支始终读取自选中的 Workspace。

## 🗂️ 删除行为

删除 Worktree Workspace 时：

1. 删除 Git Worktree 目录。
2. 删除 DSH Workspace 注册。
3. 保留对话，并将其显示在 **未分组** 中。

不会删除任何对话。

## 🛠️ 开发

```sh
pnpm install
pnpm test
```

该命令会构建 Host 和 Client bundle，运行类型检查与单元测试，并验证已提交的构建产物。

常用快捷命令：

```sh
pnpm typecheck
pnpm test:unit
```
