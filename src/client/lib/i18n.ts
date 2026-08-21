import { useSyncExternalStore } from "react"

const NS = "dsh-worktree"
type Dict = Record<string, string>

const zh: Dict = {
  createWorktree: "创建 Worktree",
  dialogTitle: "创建 Worktree",
  basedOn: "基于分支",
  taskName: "任务名称",
  taskNamePlaceholder: "例如 login-fix",
  newBranch: "新分支：{branch}",
  directory: "目录：{path}",
  cancel: "取消",
  createAndOpen: "创建并打开",
  creating: "创建中…",
  loading: "读取中…",
  fillTaskName: "请填写任务名称。",
  operationFailed: "Worktree 操作失败：",
  close: "关闭",
  notGitWorkspace: "当前 Workspace 不是 Git 仓库。",
}

const en: Dict = {
  createWorktree: "Create Worktree",
  dialogTitle: "Create Worktree",
  basedOn: "Base branch",
  taskName: "Task name",
  taskNamePlaceholder: "e.g. login-fix",
  newBranch: "New branch: {branch}",
  directory: "Directory: {path}",
  cancel: "Cancel",
  createAndOpen: "Create and open",
  creating: "Creating…",
  loading: "Loading…",
  fillTaskName: "Enter a task name.",
  operationFailed: "Worktree operation failed: ",
  close: "Close",
  notGitWorkspace: "The current Workspace is not a Git repository.",
}

let localeService: any = null
let boundT: ((key: string) => string) | null = null

export function installLocale(ctx: any) {
  const locale = ctx.get("locale")
  if (locale === undefined) return
  localeService = locale
  try {
    locale.register(NS, "zh", zh)
    locale.register(NS, "en", en)
  } catch {
    // HMR may re-run registration; the existing dictionary is still valid.
  }
  boundT = locale.bind(NS)
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
