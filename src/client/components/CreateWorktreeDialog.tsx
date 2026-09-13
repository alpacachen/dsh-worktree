import { useEffect, useId, useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { createWorktreeApi } from "../lib/api"
import { format, useT } from "../lib/i18n"
import { cleanPath, slugOf, suggestedPath } from "../lib/paths"
import type { SessionsService, WorkspacesService, Workspace, WorktreeList } from "../lib/types"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "./ui"

type BaseChoice = "current" | "main"

interface CreateWorktreeDialogProps {
  target: Pick<Workspace, "path" | "title">
  api: ReturnType<typeof createWorktreeApi>
  workspaces: WorkspacesService
  sessions: SessionsService
  defaultBaseChoice?: BaseChoice
  onCreated: (path: string) => void
  onClose: () => void
}

export function CreateWorktreeDialog({ target, api, workspaces, sessions, defaultBaseChoice = "current", onCreated, onClose }: CreateWorktreeDialogProps) {
  const t = useT()
  const id = useId()
  const [data, setData] = useState<WorktreeList | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [taskName, setTaskName] = useState("")
  const [baseChoice, setBaseChoice] = useState<BaseChoice>(defaultBaseChoice)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  // Prevent duplicate mutations even before React commits the disabled state.
  const busyRef = useRef(false)
  const [recovery, setRecovery] = useState<{ repoPath: string; path: string; branch: string } | null>(null)

  useEffect(() => {
    setTaskName("")
    setBaseChoice(defaultBaseChoice)
    setRecovery(null)
  }, [defaultBaseChoice, target.path])

  useEffect(() => {
    let alive = true
    setData(null)
    setLoading(true)
    setError("")
    api.list(target.path).then((next) => {
      if (alive) setData(next)
    }).catch((reason) => {
      if (alive) setError(String(reason?.message ?? reason))
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [api, target.path, loadAttempt])

  const repoPath = data?.repoPath
  // slugOf has a fallback for other callers; a create form must not silently
  // turn empty or punctuation-only input into a task named "task".
  const normalizedName = taskName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  const taskSlug = normalizedName ? slugOf(taskName) : ""
  const validSlug = /^[a-z0-9_][a-z0-9._-]*$/.test(taskSlug)
    && !taskSlug.includes("..") && !taskSlug.endsWith(".") && !taskSlug.endsWith(".lock")
  const taskBranch = validSlug ? `task/${taskSlug}` : ""
  const taskPath = repoPath && validSlug ? suggestedPath(repoPath, taskSlug) : ""
  const currentBranch = data?.worktrees.find((row) => cleanPath(row.path) === cleanPath(target.path))?.branch
    ?? "HEAD"
  const mainBranch = data?.defaultBranch
    ?? data?.worktrees.find((row) => row.isMain)?.branch
    ?? currentBranch
  const baseRef = baseChoice === "main" ? data?.defaultRef ?? mainBranch : currentBranch
  const invalidName = taskName.length > 0 && !validSlug
  const fieldsDisabled = busy || loading || !data || !!recovery

  const startBusy = () => { busyRef.current = true; setBusy(true); setError("") }
  const endBusy = () => { busyRef.current = false; setBusy(false) }
  const dismiss = () => { if (!busyRef.current) onClose() }

  const registerAndOpen = async (createdPath: string, slug: string) => {
    const workspace = await workspaces.create({ path: createdPath })
    try {
      await workspaces.rename(workspace.workspaceId, `${target.title}/${slug}`)
      const sessionId = await sessions.create({ workspaceId: workspace.workspaceId })
      onCreated(createdPath)
      sessions.open(sessionId)
      onClose()
    } catch (reason) {
      // A failed retry must not leave another partially registered Workspace.
      await workspaces.delete(workspace.workspaceId)
      throw reason
    }
  }

  const retryRegister = async () => {
    if (!recovery || busyRef.current) return
    startBusy()
    try { await registerAndOpen(recovery.path, recovery.branch.replace(/^task\//, "")); setRecovery(null) }
    catch (reason: any) { setError(`${t("registerFailed")} ${String(reason?.message ?? reason)}`) }
    finally { endBusy() }
  }

  const cleanupCreated = async () => {
    if (!recovery || busyRef.current) return
    startBusy()
    try { await api.remove({ repoPath: recovery.repoPath, path: recovery.path }); setRecovery(null); onClose() }
    catch (reason: any) { setError(format(t("cleanupFailed"), { error: String(reason?.message ?? reason), path: recovery.path })) }
    finally { endBusy() }
  }

  const create = async () => {
    if (busyRef.current || recovery || loading || !data || !repoPath) return
    if (!validSlug) {
      setError(t(taskName.trim() ? "invalidTaskName" : "fillTaskName"))
      return
    }
    startBusy()
    let createdPath: string | undefined
    let workspace: Workspace | undefined
    try {
      const created = await api.create({ repoPath, path: taskPath, branch: taskBranch, baseRef })
      createdPath = created.path
      workspace = await workspaces.create({ path: created.path })
      await workspaces.rename(workspace.workspaceId, `${target.title}/${taskSlug}`)
      const sessionId = await sessions.create({ workspaceId: workspace.workspaceId })
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
      endBusy()
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent busy={busy}>
        <header className="dswt-dialog-heading">
          <DialogTitle className="dswt-dialog-title">{format(t("dialogTitle"), { name: target.title })}</DialogTitle>
          <DialogDescription className="dswt-form-note">{t("createDescription")}</DialogDescription>
          <div className="dswt-repo-context"><strong>{target.title}</strong><code title={repoPath ?? target.path}>{repoPath ?? target.path}</code></div>
        </header>

        <form className="dswt-create-form" onSubmit={(event) => { event.preventDefault(); void create() }} aria-busy={busy}>
          <div className="dswt-dialog-body">
            {error ? <div className="dswt-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div> : null}
            {loading ? <div className="dswt-dialog-loading" role="status">
              <div><Loader2 size={16} className="dswt-spin" aria-hidden="true" /> {t("loadingRepository")}</div>
              <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
            </div> : !data ? <Button type="button" className="dswt-button-ghost" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t("retry")}</Button> : <>
              <div className="dswt-field">
                <label className="dswt-field-label" htmlFor={`${id}-name`}>{t("taskName")}</label>
                <Input id={`${id}-name`} value={taskName} disabled={fieldsDisabled} onChange={(event) => setTaskName(event.target.value)} placeholder={t("taskNamePlaceholder")} autoFocus autoComplete="off" spellCheck={false} aria-invalid={invalidName || undefined} aria-describedby={`${id}-name-note`} />
                <p id={`${id}-name-note`} className="dswt-form-note">{t(invalidName ? "invalidTaskName" : "taskNameHint")}</p>
              </div>

              <fieldset className="dswt-field dswt-base-fieldset" disabled={fieldsDisabled}>
                <legend className="dswt-field-label">{t("basedOn")}</legend>
                <div className="dswt-radio-group" role="radiogroup" aria-label={t("basedOn")}>
                  {(["current", "main"] as const).map((choice) => <label key={choice} htmlFor={`${id}-${choice}`} className="dswt-radio-option" data-selected={baseChoice === choice ? "true" : undefined}>
                    <input id={`${id}-${choice}`} className="dswt-radio-input" type="radio" name={`${id}-base-branch`} value={choice} checked={baseChoice === choice} onChange={() => setBaseChoice(choice)} />
                    <span className="dswt-radio-copy"><span className="dswt-radio-label">{t(choice === "current" ? "currentBranch" : "mainBranch")}</span><span className="dswt-radio-branch">{choice === "current" ? currentBranch : mainBranch}</span></span>
                  </label>)}
                </div>
              </fieldset>

              <dl className="dswt-preview" aria-live="polite" aria-atomic="true">
                <div className="dswt-preview-row"><dt className="dswt-preview-label">{t("branch")}</dt><dd className="dswt-preview-value">{recovery?.branch ?? (taskBranch || "—")}</dd></div>
                <div className="dswt-preview-row"><dt className="dswt-preview-label">{t("destinationPath")}</dt><dd className="dswt-preview-value">{recovery?.path ?? (taskPath || "—")}</dd></div>
              </dl>
            </>}
          </div>

          <footer className="dswt-dialog-footer">
            {recovery ? <>
              <Button type="button" className="dswt-button-danger" disabled={busy} onClick={() => void cleanupCreated()}>{t("cleanupCreated")}</Button>
              <Button type="button" className="dswt-button-primary" disabled={busy} onClick={() => void retryRegister()}>{busy ? <Loader2 size={16} className="dswt-spin" aria-hidden="true" /> : null}{t("retryRegister")}</Button>
            </> : <>
              <Button type="button" className="dswt-button-ghost" disabled={busy} onClick={dismiss}>{t("cancel")}</Button>
              <Button type="submit" className="dswt-button-primary" disabled={busy || loading || !repoPath || !validSlug}>
                {busy ? <Loader2 size={16} className="dswt-spin" aria-hidden="true" /> : null}
                {busy ? t("creating") : t("createAndOpen")}
              </Button>
            </>}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
