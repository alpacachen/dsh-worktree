<div align="center">

# dsh-worktree

### Parallel Git workspaces, inside DeepSeek Harness.

Create isolated Git worktrees without leaving DSH.

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
2. Open its Workspace menu and choose **创建 Worktree** / **Create Worktree**.
3. Enter a task name, for example `login-fix`.
4. Choose a base:
   - **当前分支 / Current branch** — the branch of the selected Workspace.
   - **主分支 / Main branch** — the repository default branch.
5. Click **创建并打开** / **Create and open**.

The result looks like this:

```text
project/                         # existing Workspace
project.worktrees/login-fix/     # new Workspace
└── branch: task/login-fix
```

## 🌿 Branch selection

The main branch is resolved in this order:

1. `origin/HEAD`, such as `origin/main`.
2. An existing `main`, `master`, `trunk`, or `develop` branch.
3. The repository's primary worktree branch as a fallback.

The current branch is always read from the selected Workspace.

## 🗂️ Delete behavior

Deleting a Worktree Workspace:

1. Removes the Git worktree directory.
2. Removes the DSH Workspace registration.
3. Keeps its conversations and shows them under **Ungrouped / 未分组**.

No conversation is deleted.

## 🛠️ Development

```sh
pnpm install
pnpm test
```

The test command builds the Host and Client bundles, runs type checks and unit tests, and verifies the tracked package artifacts.

Useful shortcuts:

```sh
pnpm typecheck
pnpm test:unit
```
