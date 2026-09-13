import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, ArrowUpRight, Check, ChevronDown, ChevronRight, FolderGit2, GitBranch, GitFork, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react"
import { format, useT } from "../lib/i18n"
import { cleanPath } from "../lib/paths"
import type { Workspace, Worktree, WorktreeList, WorkspacesService, SessionsService } from "../lib/types"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Select } from "./ui"

interface Props {
  api: any
  workspaces: WorkspacesService
  sessions: SessionsService
  close?: () => void
  onCreate?: (target: Pick<Workspace, "path" | "title">) => void
}
type Filter = "all" | "linked" | "attention"
const repoName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path
const relativePath = (repoPath: string, path: string) => path.startsWith(`${repoPath}/`) ? path.slice(repoPath.length + 1) : path

export function WorktreesSettings({ api, workspaces, sessions, close, onCreate }: Props) {
  const t = useT()
  const [repos, setRepos] = useState<WorktreeList[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [action, setAction] = useState<string | null>(null)
  const [scope, setScope] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [removal, setRemoval] = useState<{ repo: WorktreeList; row: Worktree } | null>(null)
  const [removalError, setRemovalError] = useState("")
  const refreshController = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    refreshController.current?.abort()
    const controller = new AbortController()
    refreshController.current = controller
    setBusy(true); setError("")
    try {
      const seen = new Set<string>()
      const paths = scope ? [scope] : workspaces.list.getSnapshot().items.map((workspace: Workspace) => workspace.path)
      const lists: WorktreeList[] = await api.scan(paths, controller.signal)
      if (controller.signal.aborted) return
      const discovered = lists.filter(list => {
        const key = cleanPath(list.repoPath)
        if (!key || seen.has(key)) return false
        seen.add(key); return true
      }).map(list => ({ ...list, currentBranch: list.worktrees.find(row => row.isMain)?.branch, worktrees: list.worktrees.filter(row => !row.isMain) }))
      setRepos(discovered.map(list => ({ ...list, worktrees: list.worktrees.map(row => ({ ...row, statusError: t("checkingStatus") })) })))
      const next = await Promise.all(discovered.map(async list => ({
        ...list,
        worktrees: await Promise.all(list.worktrees.map(async row => {
          try { return { ...row, ...(await api.status(row.path, controller.signal)) } }
          catch (reason: any) { return { ...row, statusError: String(reason?.message ?? reason) } }
        })),
      })))
      if (!controller.signal.aborted) setRepos(next)
    } catch (reason: any) {
      if (!controller.signal.aborted) setError(String(reason?.message ?? reason))
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }, [api, workspaces, scope, t])
  useEffect(() => {
    void refresh()
    return () => { refreshController.current?.abort() }
  }, [refresh])

  const needsAttention = (row: Worktree) => !!(row.changedFiles || row.locked || row.prunable || (row.statusError && row.statusError !== t("checkingStatus")))
  const needle = query.trim().toLocaleLowerCase()
  const visibleRepos = repos.filter(repo => {
    if (filter === "linked" && repo.worktrees.length === 0) return false
    if (filter === "attention" && !repo.worktrees.some(needsAttention)) return false
    return !needle || [repo.repoPath, repo.currentBranch, ...repo.worktrees.flatMap(row => [row.path, row.branch])].some(value => value?.toLocaleLowerCase().includes(needle))
  })
  const totalWorktrees = repos.reduce((count, repo) => count + repo.worktrees.length, 0)
  const statusLabel = (row: Worktree) => {
    if (row.statusError === t("checkingStatus")) return t("checkingStatus")
    if (row.statusError) return /worktree-unavailable|ENOENT|No such file/i.test(row.statusError) ? t("unavailable") : row.statusError === "not-git-repository" ? t("notGitWorkspace") : row.statusError
    if (row.changedFiles) return format(t("dirty"), { count: String(row.changedFiles) })
    if (row.prunable) return t("prunable")
    return t("clean")
  }
  const toggleRepo = (path: string) => setCollapsed(previous => {
    const next = new Set(previous)
    if (next.has(path)) next.delete(path); else next.add(path)
    return next
  })
  const openSession = async (repo: WorktreeList, row: Worktree) => {
    setAction(`open:${row.path}`); setError("")
    try {
      let workspace = workspaces.list.getSnapshot().items.find(item => cleanPath(item.path) === cleanPath(row.path))
      if (!workspace) {
        workspace = await workspaces.create({ path: row.path })
        await workspaces.rename(workspace.workspaceId, `${repoName(repo.repoPath)}/${row.branch ?? repoName(row.path)}`)
      }
      const sessionId = await sessions.create({ workspaceId: workspace.workspaceId })
      sessions.open(sessionId)
      close?.()
    } catch (reason: any) { setError(`${t("operationError")}${String(reason?.message ?? reason)}`) }
    finally { setAction(null) }
  }
  const remove = async () => {
    if (!removal || action) return
    const { repo, row } = removal
    if (row.changedFiles || row.locked) return
    setAction(`remove:${row.path}`); setRemovalError("")
    try {
      // Recheck clean worktrees at confirmation time; never force a removal.
      if (!row.statusError) {
        const latest = await api.status(row.path)
        if (latest.changedFiles) throw new Error(t("removeChanged"))
      }
      await api.remove({ repoPath: repo.repoPath, path: row.path })
      const workspace = workspaces.list.getSnapshot().items.find(item => cleanPath(item.path) === cleanPath(row.path))
      if (workspace) await workspaces.delete(workspace.workspaceId)
      setRemoval(null)
      await refresh()
    } catch (reason: any) { setRemovalError(`${t("operationError")}${String(reason?.message ?? reason)}`) }
    finally { setAction(null) }
  }

  return <section className="dswt-settings" aria-label={t("worktrees")}>
    <header className="dswt-settings-header">
      <div><h2>{t("worktrees")}</h2><p>{t("panelDescription")}</p></div>
    </header>
    <div className="dswt-toolbar">
      <label className="dswt-search"><Search size={16} aria-hidden="true" /><Input aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} value={query} onChange={event => setQuery(event.target.value)} />{query ? <Button className="dswt-icon-button" aria-label={t("clearFilters")} onClick={() => setQuery("")}><X size={14} /></Button> : null}</label>
      <div className="dswt-scope"><Select aria-label={t("scanScope")} value={scope} onChange={event => setScope(event.target.value)}><option value="">{t("allWorkspaces")}</option>{workspaces.list.getSnapshot().items.map(workspace => <option key={workspace.workspaceId} value={workspace.path}>{workspace.title}</option>)}</Select><ChevronDown size={14} aria-hidden="true" /></div>
      <Button className="dswt-icon-button dswt-refresh" aria-label={t("refresh")} title={t("refresh")} disabled={busy || !!action} onClick={() => void refresh()}><RefreshCw size={16} className={busy ? "dswt-spin" : undefined} /></Button>
    </div>
    <div className="dswt-list-controls">
      <div className="dswt-filters" role="group" aria-label={t("worktrees")}>{([['all', 'filterAll'], ['linked', 'filterLinked'], ['attention', 'filterAttention']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(label)}</button>)}</div>
      <span className="dswt-summary">{repos.length} {t("repositories")}<span aria-hidden="true">·</span>{totalWorktrees} {t("worktreeCount")}</span>
    </div>
    {error ? <div className="dswt-error" role="alert"><AlertCircle size={16} /><span>{error}</span><Button className="dswt-button-ghost" disabled={busy} onClick={() => void refresh()}>{t("retry")}</Button></div> : null}
    {busy ? <div className="dswt-loading-message" role="status"><Loader2 size={14} className="dswt-spin" /><span>{t("scanning")}</span></div> : null}
    {busy && repos.length === 0 ? <div className="dswt-skeleton-list" aria-hidden="true">{[0, 1, 2].map(index => <div className="dswt-skeleton-row" key={index}><span /><div><span /><span /></div></div>)}</div> : null}
    {!busy && visibleRepos.length === 0 ? <div className="dswt-empty"><FolderGit2 size={26} strokeWidth={1.5} /><h3>{repos.length ? t("noMatches") : t("noWorktrees")}</h3><p>{repos.length ? t("noMatchesHint") : t("noWorktreesHint")}</p>{repos.length ? <Button onClick={() => { setQuery(""); setFilter("all") }}>{t("clearFilters")}</Button> : null}</div> : null}
    <div className="dswt-repo-list">
      {visibleRepos.map(repo => {
        const canExpand = repo.worktrees.length > 0
        const expanded = canExpand && !collapsed.has(repo.repoPath)
        return <article className="dswt-repo" key={repo.repoPath}>
          <header className="dswt-repo-header">
            <button type="button" className="dswt-repo-toggle" onClick={() => toggleRepo(repo.repoPath)} disabled={!canExpand} aria-expanded={canExpand ? expanded : undefined} aria-label={`${expanded ? t("hideRepository") : t("showRepository")} ${repoName(repo.repoPath)}`}>
              {canExpand ? <ChevronRight size={14} className="dswt-chevron" /> : <span className="dswt-chevron-placeholder" />}<FolderGit2 size={18} className="dswt-repo-icon" />
              <span className="dswt-repo-heading"><span className="dswt-repo-title"><h3>{repoName(repo.repoPath)}</h3><span className="dswt-branch-label" title={`${t("currentBranchLabel")}: ${repo.currentBranch ?? t("detached")}`}><GitBranch size={12} /><span className="dswt-visually-hidden">{t("currentBranchLabel")}</span><span className="dswt-branch-value">{repo.currentBranch ?? t("detached")}</span></span>{repo.worktrees.length > 0 ? <span className="dswt-count">{repo.worktrees.length}</span> : null}</span><span className="dswt-repo-path" title={repo.repoPath}>{repo.repoPath}</span></span>
            </button>
            {onCreate ? <Button className="dswt-button-ghost dswt-create-repo" aria-label={t("createWorktree")} title={`${t("createWorktree")} · ${repoName(repo.repoPath)}`} onClick={() => onCreate({ path: repo.repoPath, title: repoName(repo.repoPath) })}><Plus size={15} /><span>{t("newWorktree")}</span></Button> : null}
          </header>
          {expanded ? <div className="dswt-worktree-list">
            {repo.worktrees.length === 0 ? <p className="dswt-no-linked">{t("noLinkedWorktrees")}</p> : repo.worktrees.map(row => {
              const state = row.statusError === t("checkingStatus") ? "checking" : row.statusError ? "unavailable" : row.changedFiles ? "dirty" : row.prunable ? "prunable" : "clean"
              const removeReason = row.changedFiles ? t("removeBlocked") : row.locked ? t("removeLocked") : t("remove")
              return <div className="dswt-worktree" key={row.path}>
                <GitFork size={16} className="dswt-tree-icon" aria-hidden="true" />
                <div className="dswt-worktree-info"><div className="dswt-worktree-title"><strong>{row.branch ?? t("detached")}</strong><span className={`dswt-status dswt-status-${state}`} title={row.statusError}><span className="dswt-status-dot" />{statusLabel(row)}</span>{row.locked ? <span className="dswt-status">{t("locked")}</span> : null}</div><div className="dswt-worktree-path" title={row.path}>{relativePath(repo.repoPath, row.path)}</div></div>
                <div className="dswt-worktree-actions"><Button className="dswt-icon-button" disabled={!!action || busy || !!row.statusError} aria-label={t("openSession")} title={t("openSession")} onClick={() => void openSession(repo, row)}>{action === `open:${row.path}` ? <Loader2 size={15} className="dswt-spin" /> : <ArrowUpRight size={16} />}</Button><Button className="dswt-icon-button dswt-delete-action" disabled={busy || !!action || !!row.changedFiles || row.locked} aria-label={t("remove")} title={removeReason} onClick={() => { setRemovalError(""); setRemoval({ repo, row }) }}><Trash2 size={15} /></Button></div>
              </div>
            })}
          </div> : null}
        </article>
      })}
    </div>
    <details className="dswt-scan-help"><summary>{t("scanHelp")}</summary><p>{t("worktreesSubtitle")}</p></details>
    <Dialog open={!!removal} onOpenChange={open => { if (!open && !action) setRemoval(null) }}>
      {removal ? <DialogContent busy={!!action} className="dswt-confirm-dialog"><div className="dswt-dialog-heading"><DialogTitle className="dswt-dialog-title">{t("removeTitle")}</DialogTitle><DialogDescription className="dswt-form-note">{t("removeDescription")}</DialogDescription></div><div className="dswt-dialog-body"><div className="dswt-remove-target"><GitFork size={18} /><div><strong>{removal.row.branch ?? t("detached")}</strong><code>{removal.row.path}</code></div></div><p className="dswt-preserved"><Check size={14} />{t("branchPreserved")}</p>{removalError ? <div className="dswt-error" role="alert"><AlertCircle size={16} /><span>{removalError}</span></div> : null}</div><div className="dswt-dialog-footer"><Button className="dswt-button-ghost" disabled={!!action} onClick={() => setRemoval(null)}>{t("cancel")}</Button><Button className="dswt-button-danger-solid" disabled={!!action} onClick={() => void remove()}>{action ? <Loader2 size={14} className="dswt-spin" /> : <Trash2 size={14} />}{action ? t("removing") : t("removeConfirmAction")}</Button></div></DialogContent> : null}
    </Dialog>
  </section>
}
