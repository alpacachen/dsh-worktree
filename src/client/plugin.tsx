import { useEffect, useState } from "react"
import css from "./styles.css"
import { CreateWorktreeDialog } from "./components/CreateWorktreeDialog"
import { GitTreeIcon } from "./components/GitTreeIcon"
import { NewSessionWorktreeButton } from "./components/NewSessionWorktreeButton"
import { WorktreesSettings } from "./components/WorktreesSettings"
import { createWorktreeApi } from "./lib/api"
import { installLocale, NS, t } from "./lib/i18n"
import { cleanPath } from "./lib/paths"
import type { Workspace, WorkspaceExtensions } from "./lib/types"

const STYLE_TAG = "data-dsh-simple-worktree-style"

function installStyles() {
  if (typeof document === "undefined" || document.querySelector(`style[${STYLE_TAG}]`)) return
  const style = document.createElement("style")
  style.setAttribute(STYLE_TAG, "")
  style.textContent = css
  document.head.appendChild(style)
  return () => style.remove()
}

export const WorktreePlugin = {
  name: "@alpacachen/dsh-simple-worktree",
  // workspaceExtensions was introduced after the initial DSH workspace client.
  // Keep it optional so older DSH versions can still load the core worktree UI.
  inject: ["slots", "connection", "locale", "workspaces", "sessions"],
  apply(ctx: any) {
    ctx.effect(installStyles, "dsh-simple-worktree styles")
    ctx.effect(() => installLocale(ctx), "dsh-simple-worktree locale")
    const api = createWorktreeApi(ctx.connection)
    const workspaces = ctx.workspaces
    const sessions = ctx.sessions
    const locale = ctx.get("locale")
    const workspaceExtensions = ctx.get("workspaceExtensions") as WorkspaceExtensions | undefined
    const gitWorkspacePaths = new Set<string>()

    ctx.effect(() => {
      if (!locale || typeof locale.subscribe !== "function" || !workspaceExtensions) return
      return locale.subscribe(() => workspaceExtensions.invalidate())
    }, "dsh-simple-worktree locale refresh")
    const worktreePaths = new Set<string>()
    let active = true
    let openCreate: (workspace: Workspace, defaultBaseChoice?: "current" | "main") => void = () => {}
    let refreshGeneration = 0

    const refreshClassification = async () => {
      const generation = ++refreshGeneration
      const items = workspaces.list.getSnapshot().items as Workspace[]
      const classified = await Promise.all(items.map(async (workspace) => {
        try {
          return await api.classify(workspace.path)
        } catch {
          return undefined
        }
      }))
      if (!active || generation !== refreshGeneration) return
      gitWorkspacePaths.clear()
      worktreePaths.clear()
      for (const item of classified) {
        if (item?.isGit && item.path) gitWorkspacePaths.add(cleanPath(item.path))
        if (item?.isWorktree && item.path) worktreePaths.add(cleanPath(item.path))
      }
      workspaceExtensions?.invalidate()
    }

    ctx.effect(() => {
      if (!workspaceExtensions) return
      const dispose = workspaceExtensions.register({
        id: "dsh-simple-worktree",
        menuItem(workspace) {
          const path = cleanPath(workspace.path)
          if (!gitWorkspacePaths.has(path) || worktreePaths.has(path)) return undefined
          return {
            id: "dsh-simple-worktree.create",
            label: t("createWorktree"),
            icon: <GitTreeIcon />,
            order: 30,
            onSelect: () => openCreate(workspace),
          }
        },
        deleteWorkspace(workspace) {
          const path = cleanPath(workspace.path)
          if (!worktreePaths.has(path)) return undefined
          return (async () => {
            const classified = await api.classify(workspace.path)
            if (!classified.isWorktree || !classified.repoPath) return
            await api.remove({ repoPath: classified.repoPath, path: workspace.path })
            await workspaces.delete(workspace.workspaceId)
            gitWorkspacePaths.delete(path)
            worktreePaths.delete(path)
            workspaceExtensions?.invalidate()
          })()
        },
        icon(workspace) {
          return worktreePaths.has(cleanPath(workspace.path)) ? <GitTreeIcon /> : undefined
        },
      })
      return dispose
    }, "dsh-simple-worktree workspace extensions")

    ctx.effect(() => {
      active = true
      const dispose = workspaces.list.subscribe(() => { void refreshClassification() })
      void refreshClassification()
      return () => {
        active = false
        refreshGeneration += 1
        dispose()
      }
    }, "dsh-simple-worktree workspace classification")

    function WorktreeOverlay() {
      const [request, setRequest] = useState<{ target: Workspace; defaultBaseChoice: "current" | "main" } | null>(null)
      useEffect(() => {
        openCreate = (target, defaultBaseChoice = "current") => setRequest({ target, defaultBaseChoice })
        return () => { openCreate = () => {} }
      }, [])
      return request ? (
        <CreateWorktreeDialog
          target={request.target}
          api={api}
          workspaces={workspaces}
          sessions={sessions}
          defaultBaseChoice={request.defaultBaseChoice}
          onCreated={(path) => {
            gitWorkspacePaths.add(cleanPath(path))
            worktreePaths.add(cleanPath(path))
            workspaceExtensions?.invalidate()
          }}
          onClose={() => setRequest(null)}
        />
      ) : null
    }

    ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
      { name: "conversation.input.dock", id: "dsh-simple-worktree-new-session", order: -30, locale: NS, label: () => t("createWorktree") },
      (props: any) => (
        <NewSessionWorktreeButton
          session={props.session}
          useWorkspaces={props.useWorkspaces}
          onOpen={(workspace) => openCreate(workspace, "main")}
        />
      ),
    ))

    ctx.slots.inject("shell.overlay", () => ctx.slots.register(
      { name: "shell.overlay", id: "dsh-simple-worktree-create", order: 30, locale: NS, label: () => t("createWorktree") },
      WorktreeOverlay,
    ))

    // DSH's official settings extension point renders this inside Settings → Plugins.
    ctx.slots.inject("settings.plugin.item", () => ctx.slots.register(
      { name: "settings.plugin.item", key: NS, locale: NS, inject: () => ({}) },
      () => <WorktreesSettings api={api} workspaces={workspaces} sessions={sessions} />,
    ))
  },
}
