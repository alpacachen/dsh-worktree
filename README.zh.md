# dsh-worktree

一个用于 DeepSeek Harness 的 Git Worktree 插件：创建任务分支、注册 DSH Workspace，并打开隔离会话。

> npm 包：`@alpacachen/dsh-simple-worktree`

[![npm version](https://img.shields.io/npm/v/@alpacachen/dsh-simple-worktree?color=5b8def&label=npm)](https://www.npmjs.com/package/@alpacachen/dsh-simple-worktree)
![DeepSeek Harness Plugin](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-7c5cff)
[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
![License](https://img.shields.io/badge/license-MIT-22c55e)

**简体中文** · [English](README.md)

![从 DSH 新建对话创建 Worktree](docs/preview.png)

## 功能

- 从新建对话入口或任意 Git Workspace 菜单创建 Worktree。
- 支持当前分支和仓库主分支。
- 将新 Worktree 注册为 DSH Workspace，并打开隔离会话。
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

### 从新建对话创建

1. 在 Git Workspace 中打开**新建对话**。
2. 点击输入框上方的**创建 Worktree**。
3. 输入任务名称；此入口默认选择仓库主分支。
4. 点击**创建并打开**。

### 从 Workspace 菜单创建

1. 打开 Git Workspace 菜单，选择**创建 Worktree**。
2. 输入任务名称，例如 `login-fix`。
3. 选择**当前分支**或**主分支**。
4. 点击**创建并打开**。

Worktree 会创建在：

```text
project.worktrees/login-fix/
└── branch: task/login-fix
```

新 Workspace 的名称为 `<父 Workspace>/<任务名称>`。删除 Worktree Workspace 不会删除对应的 Git 分支。
