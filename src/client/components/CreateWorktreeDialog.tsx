import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { createWorktreeApi } from "../lib/api"
import { format, useT } from "../lib/i18n"
import { slugOf, suggestedPath } from "../lib/paths"
import type { SessionsService, WorkspacesService, Workspace, WorktreeList } from "../lib/types"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "./ui"

type BaseChoice = "current" | "main"

interface CreateWorktreeDialogProps {
  target: Workspace
  api: ReturnType<typeof createWorktreeApi>
  workspaces: WorkspacesService
  sessions: SessionsService
  onCreated: (path: string) => void
  onClose: () => void
}

export function CreateWorktreeDialog({ target, api, workspaces, sessions, onCreated, onClose }: CreateWorktreeDialogProps) {
  const t = useT()
  const [data, setData] = useState<WorktreeList | null>(null)
  const [taskName, setTaskName] = useState("")
  const [baseChoice, setBaseChoice] = useState<BaseChoice>("current")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null)
    setError("")
    setTaskName("")
    setBaseChoice("current")
    api.list(target.path).then((next) => {
      if (!alive) return
      setData(next)
    }).catch((reason) => {
      if (alive) setError(String(reason?.message ?? reason))
    })
    return () => { alive = false }
  }, [api, target.path])

  const repoPath = data?.repoPath
  const taskSlug = slugOf(taskName)
  const taskBranch = `task/${taskSlug}`
  const taskPath = repoPath ? suggestedPath(repoPath, taskSlug) : ""
  const currentBranch = data?.worktrees.find((row) => row.path === target.path)?.branch
    ?? data?.worktrees.find((row) => row.isMain)?.branch
    ?? "HEAD"
  const mainBranch = data?.worktrees.find((row) => row.isMain)?.branch ?? currentBranch
  const baseRef = baseChoice === "main" ? mainBranch : currentBranch

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
      // Navigate only after every durable step succeeds.
      sessions.open(sessionId)
      onClose()
    } catch (reason: any) {
      if (workspace?.workspaceId) void workspaces.delete(workspace.workspaceId).catch(() => undefined)
      if (createdPath) void api.remove({ repoPath, path: createdPath }).catch(() => undefined)
      setError(`${t("operationFailed")}${String(reason?.message ?? reason)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent>
        <DialogTitle className="dwt-dialog-title">{format(t("dialogTitle"), { name: target.title })}</DialogTitle>
        <DialogDescription className="dwt-visually-hidden">{target.title}</DialogDescription>
        {error ? <div className="dwt-error" role="alert"><AlertCircle size={14} /> {error}</div> : null}

        <label className="dwt-field">
          <span className="dwt-field-label">{t("taskName")}</span>
          <Input aria-label={t("taskName")} value={taskName} disabled={busy} onChange={(event) => setTaskName(event.target.value)} placeholder={t("taskNamePlaceholder")} autoFocus />
        </label>

        <fieldset className="dwt-field dwt-base-fieldset" disabled={busy || !data}>
          <legend className="dwt-field-label">{t("basedOn")}</legend>
          <div className="dwt-radio-group" role="radiogroup" aria-label={t("basedOn")}>
            <label className="dwt-radio-option" data-selected={baseChoice === "current" ? "true" : undefined}>
              <input
                className="dwt-radio-input"
                type="radio"
                name="dwt-base-branch"
                value="current"
                checked={baseChoice === "current"}
                onChange={() => setBaseChoice("current")}
              />
              <span className="dwt-radio-copy">
                <span className="dwt-radio-label">{t("currentBranch")}</span>
                <span className="dwt-radio-branch">{currentBranch}</span>
              </span>
            </label>
            <label className="dwt-radio-option" data-selected={baseChoice === "main" ? "true" : undefined}>
              <input
                className="dwt-radio-input"
                type="radio"
                name="dwt-base-branch"
                value="main"
                checked={baseChoice === "main"}
                onChange={() => setBaseChoice("main")}
              />
              <span className="dwt-radio-copy">
                <span className="dwt-radio-label">{t("mainBranch")}</span>
                <span className="dwt-radio-branch">{mainBranch}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="dwt-dialog-actions">
          <Button type="button" disabled={busy} onClick={onClose}>{t("cancel")}</Button>
          <Button type="button" className="dwt-button-primary" disabled={busy || !taskName.trim() || !data} onClick={create}>
            {busy ? <Loader2 size={14} className="dwt-spin" /> : null}
            {busy ? t("creating") : t("createAndOpen")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
