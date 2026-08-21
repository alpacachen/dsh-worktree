# dsh-worktree

> 给 Git 一个平行宇宙：同一个仓库，同时打开多条任务线，互不踩脚。

`dsh-worktree` 是 DeepSeek Harness 的 Git worktree 插件。它把 Git 原本有点“终端巫术”的能力，变成 DSH Workspace 里一个顺手的菜单项：点一下，输入任务名，新的工作区就会出现。

## 它解决什么问题？

传统流程通常是：复制目录、切分支、记路径、再把新目录接回工具。步骤不多，但每一步都很适合忘记。

这个插件把流程压缩成：

```text
选择 Git Workspace → 创建 WorkTree → 输入名称 → 打开新 Workspace
```

每个任务拥有自己的目录和分支，主项目保持干净，多个任务可以并排推进。

## 能力清单

- 在 Git Workspace 的菜单中提供 **创建 Worktree / Create Worktree**。
- 弹窗标题会带上当前 Workspace 名称，例如 `apple WorkTree`。
- 支持两种创建基线：
  - **当前分支 / Current branch**：从你正在操作的 Workspace 分支创建。
  - **主分支 / Main branch**：优先读取 `origin/HEAD` 指向的仓库默认分支，其次识别 `main`、`master`、`trunk`、`develop`。
- 自动创建任务分支：`task/<任务名称>`。
- 自动建议隔离目录：`<仓库路径>.worktrees/<任务名称>`。
- 新 worktree 会注册成普通 DSH Workspace，并自动连接、打开。
- 删除 Worktree Workspace 时，先移除 Git worktree，再删除 DSH 注册，尽量不留下“幽灵目录”。
- 中文和英文实时跟随 DSH 语言设置切换。
- 使用 DSH 主题变量，支持浅色/深色主题，不给其他插件偷偷改字体和按钮。

## 三十秒上手

安装插件包（仓库当前作为 GitHub 插件发布）：

```bash
pnpm add github:alpacachen/dsh-worktree
```

或者在本地开发时，将构建后的包链接到 DSH 插件目录。然后在 DSH 的插件管理中启用 `dsh-worktree`。打开一个 Git Workspace，在 Workspace 菜单里找到 **创建 Worktree**，剩下的事情交给弹窗：

1. 填写任务名称，例如 `login-fix`。
2. 选择基于当前分支，或基于主分支。
3. 点击 **创建并打开**。
4. 新 Workspace 会以 `<父 Workspace>/<任务名称>` 命名。

最终得到的结构大致如下：

```text
project/                       # 原来的 Workspace
project.worktrees/login-fix/   # 新的任务 Workspace
└── branch: task/login-fix
```

## “主分支”到底是谁？

它不是简单地把第一个 worktree 的分支叫作主分支——因为第一个 worktree 也可能暂时处于 `feature` 分支。

插件会按下面的顺序询问 Git：

1. `refs/remotes/origin/HEAD`，例如 `origin/main`。
2. 已存在的常见默认分支：`main`、`master`、`trunk`、`develop`。
3. 最后才回退到 Git 列表中的主 worktree 分支。

所以“当前分支”和“主分支”是两个真正不同的 Git 来源，而不是两个换了名字的按钮。

## 语言与主题

插件目前提供：

| DSH 语言 | 界面 |
| --- | --- |
| 中文 | `创建 Worktree`、`名称`、`基于` |
| English | `Create Worktree`、`Name`、`Base` |

语言切换由 DSH 的 `locale` 服务驱动。弹窗、菜单标签和插槽标题都会响应运行时切换，不需要刷新页面。

样式使用 DSH 的主题 token，例如背景、边框、主按钮、文字和阴影变量；CSS 规则包在插件自己的 cascade layer 中，并且不注入 Tailwind Preflight 之类的全局重置。简单说：插件会穿 DSH 的衣服，但不会顺手把邻居的衣柜翻乱。

## 开发与验证

```bash
pnpm install
pnpm test
```

`pnpm test` 会依次完成：

- 构建 Host 与 Client bundle
- TypeScript 类型检查
- 单元测试
- Client 模块注册检查
- 已提交 bundle 一致性检查
- npm package 内容检查

只想快速跑测试时，也可以使用：

```bash
pnpm typecheck
pnpm test:unit
```

## 目录速览

```text
src/client/components/      React 弹窗与 UI 组件
src/client/lib/i18n.ts      DSH locale 适配与中英文文案
src/client/plugin.tsx       DSH 插件入口、菜单和 Workspace 生命周期
src/host/index.js           Git worktree RPC 与默认分支识别
src/client/styles.css       DSH 主题化样式
```

## 常见问题

### Worktree 和 Workspace 是一回事吗？

不是。Git worktree 是磁盘上的工作目录，DSH Workspace 是 DSH 对这个目录的注册。插件负责把两者牵好手。

### 会覆盖我当前分支吗？

不会。插件使用 `git worktree add -b task/<name>` 创建新目录和新分支，原 Workspace 保持原样。

### 任务名称可以随便写吗？

可以写得自然一点。插件会把名称转换成适合作为目录和分支片段的 slug，例如 `Fix Login` 会变成 `fix-login`。

### 为什么主分支识别不到？

如果仓库没有配置 `origin/HEAD`，并且本地也没有常见命名的默认分支，插件会使用主 worktree 分支作为最后兜底。这是 Git 信息不足时最安全的选择。

## License

请以仓库当前发布配置为准。
