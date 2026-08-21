<div align="center">

# dsh-simple-worktree

### Parallel Git workspaces, inside DeepSeek Harness.

Create isolated Git worktrees without leaving DSH.

[简体中文](README.zh.md) · **English**

</div>

## ✨ Features

| Create | Keep isolated | Stay in DSH |
| --- | --- | --- |
| Create a worktree from any Git Workspace. | Each task gets its own directory and branch. | The new worktree is registered and opened as a Workspace. |
| Choose the current branch or repository default branch. | Branches use `task/<name>`. | Existing conversations and Workspaces stay untouched. |

- Supports Chinese and English UI.
- Follows DSH light/dark themes and locale changes.
- Deleting a Worktree Workspace removes the Git worktree but keeps its conversations under **Ungrouped**.

## 🚀 Get started

### 1. Install

```sh
dsh plugin --profile web add github:alpacachen/dsh-worktree
```

Restart `dsh web` so the plugin bundle is loaded.

### 2. Create a worktree

1. Open a Git Workspace.
2. Open its Workspace menu and choose **Create Worktree**.
3. Enter a task name, for example `login-fix`.
4. Choose a base:
   - **Current branch** — the branch of the selected Workspace.
   - **Main branch** — the repository default branch.
5. Click **Create and open**.

The result looks like this:

```text
project/                         # existing Workspace
project.worktrees/login-fix/     # new Workspace
└── branch: task/login-fix
```
