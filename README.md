# dsh-worktree

A Git worktree plugin for DeepSeek Harness that creates task branches, registers worktrees as DSH Workspaces, and opens isolated sessions.

> npm package: `@alpacachen/dsh-simple-worktree`

[![npm version](https://img.shields.io/npm/v/@alpacachen/dsh-simple-worktree?color=5b8def&label=npm)](https://www.npmjs.com/package/@alpacachen/dsh-simple-worktree)
![DeepSeek Harness Plugin](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-7c5cff)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
![License](https://img.shields.io/badge/license-MIT-22c55e)

[简体中文](README.zh.md) · **English**

![Create a worktree from a new DSH session](docs/preview.png)

## Features

- Create a Git worktree from a new-session action or any Git Workspace menu.
- Choose the current branch or the repository's main branch.
- Register and open the new worktree as a DSH Workspace with an isolated session.
- Create task branches as `task/<name>`.
- No additional service or project configuration.
- Supports DSH themes, Chinese, and English.

## Usage

### Install

```sh
dsh plugin --profile web add @alpacachen/dsh-simple-worktree
```

Restart `dsh web` after installation.

You can also install from GitHub with `dsh plugin --profile web add github:alpacachen/dsh-worktree`.

### Create from a new session

1. Open **New Session** in a Git Workspace.
2. Choose **Create worktree** above the composer.
3. Enter a task name. The repository's main branch is selected by default.
4. Click **Create and open**.

### Create from a Workspace menu

1. Open a Git Workspace menu and choose **Create worktree**.
2. Enter a task name, such as `login-fix`.
3. Choose **Current branch** or **Main branch**.
4. Click **Create and open**.

The worktree is created at:

```text
project.worktrees/login-fix/
└── branch: task/login-fix
```

The new Workspace is named `<parent>/<task>`. Removing the worktree Workspace does not delete its Git branch.
