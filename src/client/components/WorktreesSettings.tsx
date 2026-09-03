import { useCallback, useEffect, useState } from "react"
import { AlertCircle, FolderGit2, Loader2, RefreshCw } from "lucide-react"
import { format, useT } from "../lib/i18n"
import { cleanPath } from "../lib/paths"
import type { Worktree, WorktreeList, WorkspacesService, SessionsService } from "../lib/types"
import { Button } from "./ui"

interface Props {
  api: any
  workspaces: WorkspacesService
  sessions: SessionsService
  close?: () => void
}

export function WorktreesSettings({ api, workspaces, sessions }: Props) {
  const t = useT()
  const [repos, setRepos] = useState<WorktreeList[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [action, setAction] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    setBusy(true); setError("")
    try {
      const seen = new Set<string>(); const next: WorktreeList[] = []
      const lists = await api.scan(workspaces.list.getSnapshot().items.map((workspace: any) => workspace.path))
      for (const list of lists) {
        try {
          const key = cleanPath(list.repoPath)
          if (key && !seen.has(key)) {
            seen.add(key)
            const allWorktrees = await Promise.all(list.worktrees.map(async (row: Worktree) => {
              try { return { ...row, ...(await api.status(row.path)) } }
              catch (reason: any) { return { ...row, statusError: String(reason?.message ?? reason) } }
            }))
            const worktrees = allWorktrees.filter(row => !row.isMain)
            if (worktrees.length > 0) next.push({ ...list, currentBranch: list.worktrees.find((row: Worktree) => row.isMain)?.branch, worktrees })
          }
        } catch { /* non-Git workspaces are intentionally skipped */ }
      }
      setRepos(next)
    } catch (reason: any) { setError(String(reason?.message ?? reason)) }
    finally { setBusy(false) }
  }, [api, workspaces])
  useEffect(() => { void refresh() }, [refresh])
  const statusLabel = (row: Worktree) => row.statusError === "worktree-unavailable" ? t("unavailable") : row.statusError === "not-git-repository" ? t("notGitWorkspace") : row.statusError
  const repoName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path
  const relativePath = (repoPath: string, path: string) => {
    const prefix = repoPath.endsWith("/") ? repoPath : `${repoPath}/`
    return path.startsWith(prefix) ? path.slice(prefix.length) || "." : path
  }
  const totalWorktrees = repos.reduce((count, repo) => count + repo.worktrees.length, 0)

  const remove = async (repo: WorktreeList, row: Worktree) => {
    const status = row.statusError ? t("unavailable") : row.changedFiles ? format(t("dirty"), { count: String(row.changedFiles) }) : t("clean")
    if (row.changedFiles) { setError(t("dirtyRemoveBlocked")); return }
    if (!window.confirm(format(t("removeConfirm"), { path: row.path, status }))) return
    setAction(row.path); setError("")
    try {
      await api.remove({ repoPath: repo.repoPath, path: row.path })
      const workspace = workspaces.list.getSnapshot().items.find(item => cleanPath(item.path) === cleanPath(row.path))
      if (workspace) await workspaces.delete(workspace.workspaceId)
      await refresh()
    } catch (reason: any) { setError(`${t("operationError")}${String(reason?.message ?? reason)}`) }
    finally { setAction(null) }
  }

  return <section className="dswt-settings" aria-label={t("worktrees")}>
    <div className="dswt-settings-header">
      <div>
        <h2>{t("worktrees")}</h2>
        <p className="dswt-settings-subtitle">{t("worktreesSubtitle")}</p>
      </div>
      <Button type="button" className="dswt-icon-button" aria-label={t("refresh")} title={t("refresh")} disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} className={busy ? "dswt-spin" : undefined} /></Button>
    </div>
    {repos.length > 0 ? <div className="dswt-summary"><strong>{repos.length}</strong> {t("repositories")}<span>·</span><strong>{totalWorktrees}</strong> {t("worktreeCount")}</div> : null}
    {error ? <div className="dswt-error" role="alert"><AlertCircle size={14} /> {error}</div> : null}
    {repos.length === 0 && !busy ? <div className="dswt-empty"><p>{t("noWorktrees")}</p><span>{t("noWorktreesHint")}</span></div> : null}
    <div className="dswt-repo-list">
      {repos.map(repo => {
        return <article className="dswt-repo" key={repo.repoPath}>
          <header className="dswt-repo-header">
            <div className="dswt-repo-heading"><span className="dswt-repo-icon"><FolderGit2 size={15} /></span><div><h3>{repoName(repo.repoPath)}</h3><p title={repo.repoPath}>{repo.repoPath}</p></div></div>
            <div className="dswt-repo-branch"><span>{t("currentBranchLabel")}</span><strong>{repo.currentBranch ?? t("detached")}</strong></div>
          </header>
          <div className="dswt-worktree-list">
            {repo.worktrees.map(row => {
              const state = row.statusError ? "unavailable" : row.changedFiles ? "dirty" : row.prunable ? "prunable" : "clean"
              return <div className="dswt-worktree" key={row.path}>
                <div className="dswt-worktree-info">
                  <div className="dswt-worktree-title"><strong>{row.branch ?? t("detached")}</strong></div>
                  <div className="dswt-worktree-path" title={row.path}>{relativePath(repo.repoPath, row.path)}</div>
                  <div className={`dswt-status dswt-status-${state}`}>{row.statusError ? statusLabel(row) : row.changedFiles ? format(t("dirty"), { count: String(row.changedFiles) }) : row.prunable ? t("prunable") : t("clean")}{row.locked ? ` · ${t("locked")}` : ""}</div>
                </div>
                <div className="dswt-worktree-actions"><Button type="button" className="dswt-button-danger" disabled={action === row.path} onClick={() => void remove(repo, row)}>{action === row.path ? <Loader2 size={14} className="dswt-spin" /> : null}{t("remove")}</Button></div>
              </div>
            })}
          </div>
        </article>
      })}
    </div>
  </section>
}
