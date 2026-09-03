import { useSyncExternalStore } from "react"

export const NS = "dsh-simple-worktree"
type Dict = Record<string, string>

const zh: Dict = {
  createWorktree: "创建 worktree",
  dialogTitle: "{name} worktree",
  basedOn: "基于",
  currentBranch: "当前分支",
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
  worktrees: "Worktrees",
  refresh: "刷新",
  noWorktrees: "没有发现 linked worktree。",
  branch: "分支",
  path: "路径",
  mainRepository: "主仓库",
  linkedWorktree: "linked worktree",
  clean: "clean",
  dirty: "dirty（{count} 个变更文件）",
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
  dialogTitle: "{name} worktree",
  basedOn: "Base",
  currentBranch: "Current branch",
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
  worktrees: "Worktrees",
  refresh: "Refresh",
  noWorktrees: "No linked worktrees found.",
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
