import { useEffect, useState } from "react"
import type { Context } from "@deepseek-ai/cordis"
import type { ConnectionHandle } from "@deepseek-ai/dsh-client-connection/client"
import type { PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots"
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client"
import type {} from "@deepseek-ai/dsh-client-ui-conversation/client"
import type {} from "@deepseek-ai/dsh-client-ui-layout/client"
import type {} from "@deepseek-ai/dsh-client-ui-settings/client"
import type {} from "@deepseek-ai/dsh-client-ui-workspace/client"
import type {} from "@deepseek-ai/dsh-api-workspace-controller/client"
import type {} from "@deepseek-ai/dsh-api-session-controller/client"
import css from "./styles.css"
import { CreateWorktreeDialog } from "./components/CreateWorktreeDialog"
import { GitTreeIcon } from "./components/GitTreeIcon"
import { NewSessionWorktreeButton } from "./components/NewSessionWorktreeButton"
import { WorktreesSettings } from "./components/WorktreesSettings"
import { createWorktreeApi } from "./lib/api"
import { installLocale, NS, t } from "./lib/i18n"
import { cleanPath } from "./lib/paths"
import type { Workspace } from "./lib/types"

/** The client plugin context surface this plugin touches. */
export type WorktreeClientContext = Context & {
  connection: ConnectionHandle
}

const STYLE_TAG = "data-dsh-simple-worktree-style"

function installStyles() {
  if (typeof document === "undefined" || document.querySelector(`style[${STYLE_TAG}]`)) return () => {}
  const style = document.createElement("style")
  style.setAttribute(STYLE_TAG, "")
  style.textContent = css
  document.head.appendChild(style)
  return () => style.remove()
}

export const WorktreePlugin = {
  name: "@alpacachen/dsh-simple-worktree",
  inject: ["slots", "connection", "locale", "workspaces", "sessions"],
  apply(ctx: WorktreeClientContext) {
    ctx.effect(installStyles, "dsh-simple-worktree styles")
    ctx.effect(() => installLocale(ctx), "dsh-simple-worktree locale")
    const api = createWorktreeApi(ctx.connection)
    const workspaces = ctx.workspaces
    const sessions = ctx.sessions

    // Classification drives the "Create worktree" affordance in the
    // conversation composer: only blank sessions of Git repositories that are
    // not already linked worktrees get the button.
    const gitWorkspacePaths = new Set<string>()
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
    }

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
          onCreated={() => {
            void refreshClassification()
          }}
          onClose={() => setRequest(null)}
        />
      ) : null
    }

    ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
      { name: "conversation.input.dock", id: "dsh-simple-worktree-new-session", order: -30, label: () => t("createWorktree") },
      (props: PropsRuntime<"conversation.input.dock">) => (
        <NewSessionWorktreeButton
          session={props.session}
          useWorkspaces={props.useWorkspaces}
          canCreate={(workspace) => gitWorkspacePaths.has(cleanPath(workspace.path)) && !worktreePaths.has(cleanPath(workspace.path))}
          onOpen={(workspace) => openCreate(workspace, "main")}
        />
      ),
    ))

    ctx.slots.inject("shell.overlay", () => ctx.slots.register(
      { name: "shell.overlay", id: "dsh-simple-worktree-create", order: 30, label: () => t("createWorktree") },
      WorktreeOverlay,
    ))

    // Register a first-class Settings sidebar section, alongside Plugins and
    // the other built-in settings pages. This is intentionally not a plugin
    // configuration item: Worktree management is a standalone workspace tool.
    ctx.slots.inject("settings.section", () => ctx.slots.register(
      { name: "settings.section", id: "dsh-simple-worktree", order: 45, label: () => t("worktrees"), inject: () => ({}) },
      () => <WorktreesSettings api={api} workspaces={workspaces} sessions={sessions} />,
    ))
  },
}
