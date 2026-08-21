<div align="center">

# dsh-simple-worktree

### A tiny Git worktree helper for DeepSeek Harness.

One menu item. One dialog. One isolated Workspace.

[简体中文](README.zh.md) · **English**

</div>

## Why this plugin?

`dsh-simple-worktree` does one thing: create a Git worktree and open it as a DSH Workspace.

- **Small and focused** — no board, workflow, or extra project layer.
- **No extra service** — it uses Git and DSH's existing Workspace APIs.
- **No setup** — choose a branch, enter a name, and start working.
- **Native feel** — follows DSH theme and language settings.

## 🚀 Use it

### Install

```sh
dsh plugin --profile web add github:alpacachen/dsh-worktree
```

Restart `dsh web` after installation.

### Create a worktree

1. Open a Git Workspace.
2. Choose **Create Worktree** from its menu.
3. Enter a task name, such as `login-fix`.
4. Choose **Current branch** or **Main branch**.
5. Click **Create and open**.

The plugin creates and opens:

```text
project.worktrees/login-fix/
└── branch: task/login-fix
```

The new Workspace is named `<parent>/<task>` and is ready for a separate conversation.

## What stays simple

- One small dialog instead of a new workflow.
- One Git branch per task: `task/<name>`.
- Existing Workspaces and conversations are left alone.
- Chinese and English are supported.
