import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { createWorktreeApi } from "../lib/api"
import { format, useT } from "../lib/i18n"
import { slugOf, suggestedPath } from "../lib/paths"
import type { SessionsService, WorkspacesService, Workspace, WorktreeList } from "../lib/types"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Select } from "./ui"

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
  const [baseRef, setBaseRef] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null)
    setError("")
    setTaskName("")
    setBaseRef("")
    api.list(target.path).then((next) => {
      if (!alive) return
      setData(next)
      const current = next.worktrees.find((row) => row.path === target.path)
      setBaseRef(current?.branch ?? next.worktrees[0]?.branch ?? "HEAD")
    }).catch((reason) => {
      if (alive) setError(String(reason?.message ?? reason))
    })
    return () => { alive = false }
  }, [api, target.path])

  const repoPath = data?.repoPath
  const taskSlug = slugOf(taskName)
  const taskBranch = `task/${taskSlug}`
  const taskPath = repoPath ? suggestedPath(repoPath, taskSlug) : ""
  const branchOptions = [...new Set((data?.worktrees ?? []).map((row) => row.branch).filter(Boolean) as string[])]

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
      const created = await api.create({ repoPath, path: taskPath, branch: taskBranch, baseRef: baseRef || "HEAD" })
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
        <DialogTitle className="dwt-dialog-title">{t("dialogTitle")}</DialogTitle>
        <DialogDescription className="dwt-dialog-description">{target.title}</DialogDescription>
        {error ? <div className="dwt-error" role="alert"><AlertCircle size={14} /> {error}</div> : null}
        <label className="dwt-field">
          {t("basedOn")}
          <Select aria-label={t("basedOn")} value={baseRef} disabled={busy || !data} onChange={(event) => setBaseRef(event.target.value)}>
            {(branchOptions.length ? branchOptions : ["HEAD"]).map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </Select>
        </label>
        <label className="dwt-field">
          {t("taskName")}
          <Input aria-label={t("taskName")} value={taskName} disabled={busy} onChange={(event) => setTaskName(event.target.value)} placeholder={t("taskNamePlaceholder")} />
        </label>
        <div className="dwt-hint">{format(t("newBranch"), { branch: taskBranch })}</div>
        <div className="dwt-hint">{format(t("directory"), { path: taskPath || t("loading") })}</div>
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
