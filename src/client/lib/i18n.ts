import { useSyncExternalStore } from "react"

export const NS = "dsh-simple-worktree"
type Dict = Record<string, string>

const zh: Dict = {
  createWorktree: "创建 worktree",
  createDescription: "创建独立的任务分支，并在新 Workspace 中打开会话。",
  loadingRepository: "正在读取仓库…",
  retry: "重试",
  invalidTaskName: "名称不能以点开头、以点或 .lock 结尾，或包含连续的点。",
  taskNameHint: "名称将转换为小写，空格转换为连字符。",
  destinationPath: "目标路径",
  searchPlaceholder: "搜索仓库、分支或路径",
  filterAll: "全部",
  filterLinked: "有 Worktree",
  filterAttention: "需留意",
  clearFilters: "清除筛选",
  noMatches: "没有匹配的项目",
  noMatchesHint: "试试其他名称，或清除筛选条件。",
  scanHelp: "扫描规则",
  panelDescription: "在独立分支中并行工作，不打断当前进度。",
  newWorktree: "新建",
  noLinkedWorktrees: "还没有 Worktree，可从右侧新建。",
  openSession: "打开会话",
  opening: "正在打开…",
  removeTitle: "删除这个 Worktree？",
  removeDescription: "将移除下方目录及对应的 Workspace。Git 分支会保留，此操作无法撤销。",
  removeConfirmAction: "确认删除",
  removing: "正在删除…",
  removeBlocked: "请先提交或保存更改，再删除 Worktree。",
  removeLocked: "请先解锁这个 Worktree。",
  removeChanged: "状态已变化，请刷新列表后重试。",
  branchPreserved: "保留 Git 分支",
  showRepository: "展开仓库",
  hideRepository: "收起仓库",
  dialogTitle: "新建 Worktree",
  basedOn: "基于",
  currentBranch: "当前分支",
  currentBranchLabel: "当前分支",
  mainBranch: "主分支",
  taskName: "名称",
  taskNamePlaceholder: "例如 login-fix",
  cancel: "取消",
  createAndOpen: "创建并打开",
  creating: "创建中…",
  fillTaskName: "请填写名称。",
  operationFailed: "worktree 操作失败：",
  close: "关闭",
  notGitWorkspace: "当前 Workspace 不是 Git 仓库。",
  worktrees: "Worktree 管理",
  worktreesSubtitle: "扫描 Workspace 及最多 4 层子目录，跳过隐藏、缓存和构建目录。更深的项目请单独添加为 Workspace。",
  scanning: "正在查找 Git 项目及检查 Worktree 状态，可切换到更具体的工作区…",
  checkingStatus: "正在检查状态…",
  scanScope: "扫描范围",
  allWorkspaces: "所有工作区",
  repositories: "个项目",
  worktreeCount: "个 Worktree",
  refresh: "刷新",
  noWorktrees: "没有发现 Git 项目。",
  noWorktreesHint: "请选择更具体的工作区，或将 Git 项目目录添加为 Workspace。找到项目后即可创建第一个 Worktree。",
  branch: "分支",
  path: "路径",
  mainRepository: "主仓库",
  linkedWorktree: "linked worktree",
  clean: "无更改",
  dirty: "{count} 个文件更改",
  locked: "已锁定",
  prunable: "可清理",
  open: "打开",
  remove: "删除 Worktree",
  prune: "清理失效记录",
  removeConfirm: "确认删除 Worktree？\n\n路径：{path}\n状态：{status}\n\n这不会删除 Git branch。",
  dirtyRemoveBlocked: "Worktree 有未提交变更，默认不会强制删除。",
  operationError: "操作失败：",
  unavailable: "路径不可用",
  registered: "已注册 Workspace",
  registerFailed: "Worktree 已创建，但 Workspace 注册失败。",
  cleanupFailed: "清理已创建 Worktree 失败：{error}\n路径：{path}",
  retryRegister: "重试注册并打开",
  cleanupCreated: "清理已创建 Worktree",
  detached: "（分离 HEAD）",
}

const en: Dict = {
  createWorktree: "Create worktree",
  createDescription: "Create an isolated task branch and open a session in a new Workspace.",
  loadingRepository: "Loading repository…",
  retry: "Retry",
  invalidTaskName: "Use a valid branch name: no leading dot, trailing dot or .lock, or consecutive dots.",
  taskNameHint: "Names become lowercase; spaces become hyphens.",
  destinationPath: "Destination path",
  searchPlaceholder: "Search repositories, branches or paths",
  filterAll: "All",
  filterLinked: "With worktrees",
  filterAttention: "Needs attention",
  clearFilters: "Clear filters",
  noMatches: "No matching projects",
  noMatchesHint: "Try another name or clear the filters.",
  scanHelp: "Scan rules",
  panelDescription: "Work on independent branches without interrupting your current work.",
  newWorktree: "New",
  noLinkedWorktrees: "No worktrees yet. Create one to get started.",
  openSession: "Open session",
  opening: "Opening…",
  removeTitle: "Delete this worktree?",
  removeDescription: "This removes the directory below and its Workspace. The Git branch is kept. This cannot be undone.",
  removeConfirmAction: "Confirm deletion",
  removing: "Deleting…",
  removeBlocked: "Commit or save your changes before deleting this worktree.",
  removeLocked: "Unlock this worktree before deleting it.",
  removeChanged: "The worktree status changed. Refresh the list and try again.",
  branchPreserved: "Git branch is kept",
  showRepository: "Expand repository",
  hideRepository: "Collapse repository",
  dialogTitle: "New worktree",
  basedOn: "Base",
  currentBranch: "Current branch",
  currentBranchLabel: "Current branch",
  mainBranch: "Main branch",
  taskName: "Name",
  taskNamePlaceholder: "e.g. login-fix",
  cancel: "Cancel",
  createAndOpen: "Create and open",
  creating: "Creating…",
  fillTaskName: "Enter a name.",
  operationFailed: "worktree operation failed: ",
  close: "Close",
  notGitWorkspace: "The current Workspace is not a Git repository.",
  worktrees: "Worktree Management",
  worktreesSubtitle: "Scan Workspaces up to 4 directory levels, excluding hidden, cache and build folders. Add deeper projects as their own Workspace.",
  scanning: "Finding Git projects and checking Worktree status. Select a narrower Workspace if needed…",
  checkingStatus: "Checking status…",
  scanScope: "Scan scope",
  allWorkspaces: "All Workspaces",
  repositories: "repositories",
  worktreeCount: "Worktrees",
  refresh: "Refresh",
  noWorktrees: "No Git projects found.",
  noWorktreesHint: "Select a narrower Workspace or add a Git project directory as a Workspace to create its first Worktree.",
  branch: "Branch",
  path: "Path",
  mainRepository: "Main repository",
  linkedWorktree: "Linked worktree",
  clean: "clean",
  dirty: "dirty ({count} changed files)",
  locked: "locked",
  prunable: "prunable",
  open: "Open",
  remove: "Remove Worktree",
  prune: "Prune stale record",
  removeConfirm: "Remove this Worktree?\n\nPath: {path}\nStatus: {status}\n\nThis does not delete the Git branch.",
  dirtyRemoveBlocked: "This Worktree has uncommitted changes; force removal is disabled.",
  operationError: "Operation failed: ",
  unavailable: "path unavailable",
  registered: "Workspace registered",
  registerFailed: "The Worktree was created, but Workspace registration failed.",
  cleanupFailed: "Could not clean up the created Worktree: {error}\nPath: {path}",
  retryRegister: "Retry registration and open",
  cleanupCreated: "Clean up created Worktree",
  detached: "(detached HEAD)",
}

let localeService: any = null
let boundT: ((key: string) => string) | null = null

export function installLocale(ctx: any) {
  const locale = ctx?.get?.("locale")
  if (!locale || typeof locale.register !== "function" || typeof locale.bind !== "function") return () => {}

  localeService = locale
  let dispose: (() => void) | undefined
  try {
    dispose = locale.register(NS, { zh, en })
  } catch {
    // A duplicate registration can happen during HMR; keep using the existing dictionaries.
  }
  boundT = locale.bind(NS)

  return () => {
    dispose?.()
    if (localeService === locale) {
      localeService = null
      boundT = null
    }
  }
}

export function t(key: string): string {
  if (boundT) return boundT(key)
  return zh[key] ?? key
}

const subscribe = (listener: () => void) => {
  if (localeService && typeof localeService.subscribe === "function") return localeService.subscribe(listener)
  return () => {}
}

const getSnapshot = () => {
  if (localeService && typeof localeService.getSnapshot === "function") return localeService.getSnapshot()
  return null
}

export function useT() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return t
}

export function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
}
