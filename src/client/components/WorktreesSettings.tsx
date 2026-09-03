import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
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
            const worktrees = await Promise.all(list.worktrees.map(async (row: Worktree) => {
              try { return { ...row, ...(await api.status(row.path)) } }
              catch (reason: any) { return { ...row, statusError: String(reason?.message ?? reason) } }
            }))
            next.push({ ...list, worktrees })
          }
        } catch { /* non-Git workspaces are intentionally skipped */ }
      }
      setRepos(next)
    } catch (reason: any) { setError(String(reason?.message ?? reason)) }
    finally { setBusy(false) }
  }, [api, workspaces])
  useEffect(() => { void refresh() }, [refresh])
  const statusLabel = (row: Worktree) => row.statusError === "worktree-unavailable" ? t("unavailable") : row.statusError === "not-git-repository" ? t("notGitWorkspace") : row.statusError

  const open = async (repo: WorktreeList, row: Worktree) => {
    setAction(row.path); setError("")
    try {
      let workspace = workspaces.list.getSnapshot().items.find(item => cleanPath(item.path) === cleanPath(row.path))
      const created = !workspace
      if (!workspace) workspace = await workspaces.create({ path: row.path })
      if (created) {
        const title = row.isMain ? t("mainRepository") : `${repo.defaultBranch ?? "worktree"}/${row.branch ?? "detached"}`
        await workspaces.rename(workspace.workspaceId, title)
      }
      const sessionId = await workspaces.connectWorkspace(workspace.workspaceId)
      sessions.open(sessionId)
    } catch (reason: any) { setError(`${t("operationError")}${String(reason?.message ?? reason)}`) }
    finally { setAction(null) }
  }

  const remove = async (repo: WorktreeList, row: Worktree) => {
    if (row.isMain) return
    const status = row.statusError ? t("unavailable") : row.changedFiles ? format(t("dirty"), { count: String(row.changedFiles) }) : t("clean")
    if (row.changedFiles || row.statusError) { setError(row.statusError ? `${t("operationError")}${statusLabel(row)}` : t("dirtyRemoveBlocked")); return }
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

  const prune = async (repo: WorktreeList) => {
    setAction(repo.repoPath); setError("")
    try { await api.prune(repo.repoPath); await refresh() }
    catch (reason: any) { setError(`${t("operationError")}${String(reason?.message ?? reason)}`) }
    finally { setAction(null) }
  }

  return <section className="dswt-settings" aria-label={t("worktrees")}>
    <div className="dswt-settings-header"><h2>{t("worktrees")}</h2><Button type="button" aria-label={t("refresh")} title={t("refresh")} disabled={busy} onClick={() => void refresh()}><RefreshCw size={14} className={busy ? "dswt-spin" : undefined} /></Button></div>
    {error ? <div className="dswt-error" role="alert"><AlertCircle size={14} /> {error}</div> : null}
    {repos.length === 0 && !busy ? <p className="dswt-muted">{t("noWorktrees")}</p> : null}
    {repos.map(repo => <div className="dswt-repo" key={repo.repoPath}><div className="dswt-repo-path">{repo.repoPath}<Button type="button" disabled={action === repo.repoPath} onClick={() => void prune(repo)}>{t("prune")}</Button></div>
      {repo.worktrees.map(row => <div className="dswt-worktree" key={row.path}><div className="dswt-worktree-main"><strong>{row.branch ?? t("detached")}</strong><span className="dswt-worktree-path" title={row.path}>{row.path}</span><span>{row.isMain ? t("mainRepository") : t("linkedWorktree")}</span><span>{row.statusError ? statusLabel(row) : row.changedFiles ? format(t("dirty"), { count: String(row.changedFiles) }) : t("clean")}</span>{row.locked ? <span>{t("locked")}</span> : null}{row.prunable ? <span>{t("prunable")}</span> : null}</div><div className="dswt-worktree-actions"><Button type="button" disabled={action === row.path || Boolean(row.statusError)} onClick={() => void open(repo, row)}>{action === row.path ? <Loader2 size={14} className="dswt-spin" /> : null}{t("open")}</Button>{!row.isMain && (row.prunable || row.statusError) ? <Button type="button" disabled={action === row.path} onClick={() => void prune(repo)}>{t("prune")}</Button> : null}{!row.isMain && !row.prunable && !row.statusError ? <Button type="button" disabled={action === row.path} onClick={() => void remove(repo, row)}>{t("remove")}</Button> : null}</div></div>)}
    </div>)}
  </section>
}
