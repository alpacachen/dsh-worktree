import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { createWorktreeApi } from "../lib/api"
import { format, useT } from "../lib/i18n"
import { cleanPath, slugOf, suggestedPath } from "../lib/paths"
import type { SessionsService, WorkspacesService, Workspace, WorktreeList } from "../lib/types"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "./ui"

type BaseChoice = "current" | "main"

interface CreateWorktreeDialogProps {
  target: Workspace
  api: ReturnType<typeof createWorktreeApi>
  workspaces: WorkspacesService
  sessions: SessionsService
  defaultBaseChoice?: BaseChoice
  onCreated: (path: string) => void
  onClose: () => void
}

export function CreateWorktreeDialog({ target, api, workspaces, sessions, defaultBaseChoice = "current", onCreated, onClose }: CreateWorktreeDialogProps) {
  const t = useT()
  const [data, setData] = useState<WorktreeList | null>(null)
  const [taskName, setTaskName] = useState("")
  const [baseChoice, setBaseChoice] = useState<BaseChoice>(defaultBaseChoice)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [recovery, setRecovery] = useState<{ repoPath: string; path: string; branch: string } | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError("")
    setTaskName("")
    setBaseChoice(defaultBaseChoice)
    api.list(target.path).then((next) => {
      if (!alive) return
      setData(next)
    }).catch((reason) => {
      if (alive) setError(String(reason?.message ?? reason))
    })
    return () => { alive = false }
  }, [api, defaultBaseChoice, target.path])

  const repoPath = data?.repoPath
  const taskSlug = slugOf(taskName)
  const taskBranch = `task/${taskSlug}`
  const taskPath = repoPath ? suggestedPath(repoPath, taskSlug) : ""
  const currentBranch = data?.worktrees.find((row) => cleanPath(row.path) === cleanPath(target.path))?.branch
    ?? "HEAD"
  const mainBranch = data?.defaultBranch
    ?? data?.worktrees.find((row) => row.isMain)?.branch
    ?? currentBranch
  const baseRef = baseChoice === "main" ? data?.defaultRef ?? mainBranch : currentBranch

  const registerAndOpen = async (createdPath: string, slug: string) => {
    const workspace = await workspaces.create({ path: createdPath })
    await workspaces.rename(workspace.workspaceId, `${target.title}/${slug}`)
    const sessionId = await workspaces.connectWorkspace(workspace.workspaceId)
    onCreated(createdPath)
    sessions.open(sessionId)
    onClose()
  }

  const retryRegister = async () => {
    if (!recovery) return
    setBusy(true); setError("")
    try { await registerAndOpen(recovery.path, recovery.branch.replace(/^task\//, "")); setRecovery(null) }
    catch (reason: any) { setError(`${t("registerFailed")} ${String(reason?.message ?? reason)}`) }
    finally { setBusy(false) }
  }

  const cleanupCreated = async () => {
    if (!recovery) return
    setBusy(true); setError("")
    try { await api.remove({ repoPath: recovery.repoPath, path: recovery.path }); setRecovery(null); onClose() }
    catch (reason: any) { setError(format(t("cleanupFailed"), { error: String(reason?.message ?? reason), path: recovery.path })) }
    finally { setBusy(false) }
  }

  const create = async () => {
    if (!repoPath || !taskName.trim()) {
      setError(t("fillTaskName"))
      return
    }
    setBusy(true)
    setError("")
    let createdPath: string | undefined
    let workspace: Workspace | undefined
    try {
      const created = await api.create({ repoPath, path: taskPath, branch: taskBranch, baseRef })
      createdPath = created.path
      workspace = await workspaces.create({ path: created.path })
      await workspaces.rename(workspace.workspaceId, `${target.title}/${taskSlug}`)
      const sessionId = await workspaces.connectWorkspace(workspace.workspaceId)
      onCreated(created.path)
      sessions.open(sessionId)
      onClose()
    } catch (reason: any) {
      if (workspace?.workspaceId) {
        try { await workspaces.delete(workspace.workspaceId) } catch (cleanupError: any) { if (createdPath) setRecovery({ repoPath, path: createdPath, branch: taskBranch }); setError(format(t("cleanupFailed"), { error: String(cleanupError?.message ?? cleanupError), path: createdPath ?? "" })); return }
      }
      if (createdPath) { setRecovery({ repoPath, path: createdPath, branch: taskBranch }); setError(t("registerFailed")) }
      else setError(`${t("operationFailed")}${String(reason?.message ?? reason)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent>
        <DialogTitle className="dswt-dialog-title">{format(t("dialogTitle"), { name: target.title })}</DialogTitle>
        <DialogDescription className="dswt-visually-hidden">{target.title}</DialogDescription>
        {error ? <div className="dswt-error" role="alert"><AlertCircle size={14} /> {error}</div> : null}

        <label className="dswt-field">
          <span className="dswt-field-label">{t("taskName")}</span>
          <Input aria-label={t("taskName")} value={taskName} disabled={busy} onChange={(event) => setTaskName(event.target.value)} placeholder={t("taskNamePlaceholder")} autoFocus />
        </label>

        <fieldset className="dswt-field dswt-base-fieldset" disabled={busy || !data}>
          <legend className="dswt-field-label">{t("basedOn")}</legend>
          <div className="dswt-radio-group" role="radiogroup" aria-label={t("basedOn")}>
            <label className="dswt-radio-option" data-selected={baseChoice === "current" ? "true" : undefined}>
              <input
                className="dswt-radio-input"
                type="radio"
                name="dswt-base-branch"
                value="current"
                checked={baseChoice === "current"}
                onChange={() => setBaseChoice("current")}
              />
              <span className="dswt-radio-copy">
                <span className="dswt-radio-label">{t("currentBranch")}</span>
                <span className="dswt-radio-branch">{currentBranch}</span>
              </span>
            </label>
            <label className="dswt-radio-option" data-selected={baseChoice === "main" ? "true" : undefined}>
              <input
                className="dswt-radio-input"
                type="radio"
                name="dswt-base-branch"
                value="main"
                checked={baseChoice === "main"}
                onChange={() => setBaseChoice("main")}
              />
              <span className="dswt-radio-copy">
                <span className="dswt-radio-label">{t("mainBranch")}</span>
                <span className="dswt-radio-branch">{mainBranch}</span>
              </span>
            </label>
          </div>
        </fieldset>

        {recovery ? <div className="dswt-dialog-actions"><Button type="button" disabled={busy} onClick={() => void retryRegister()}>{t("retryRegister")}</Button><Button type="button" disabled={busy} onClick={() => void cleanupCreated()}>{t("cleanupCreated")}</Button></div> : null}
        {!recovery ? <div className="dswt-dialog-actions">
          <Button type="button" disabled={busy} onClick={onClose}>{t("cancel")}</Button>
          <Button type="button" className="dswt-button-primary" disabled={busy || !taskName.trim() || !data} onClick={create}>
            {busy ? <Loader2 size={14} className="dswt-spin" /> : null}
            {busy ? t("creating") : t("createAndOpen")}
          </Button>
        </div> : null}
      </DialogContent>
    </Dialog>
  )
}
