import type { WorkspaceView, IWorkspaces } from "@deepseek-ai/dsh-api-workspace-controller/client"
import type { ISessions } from "@deepseek-ai/dsh-api-session-controller/client"

/** Workspace row projected by the Host Workspace Controller. */
export type Workspace = WorkspaceView

export interface Worktree {
  path: string
  branch?: string
  head?: string
  isMain: boolean
  detached: boolean
  locked: boolean
  prunable: boolean
  changedFiles?: number
  statusError?: string
}

export interface WorktreeStatus {
  branchLine: string
  changedFiles: number
  output: string
}

export interface WorktreeList {
  repoPath: string
  commonDir: string
  defaultBranch?: string
  defaultRef?: string
  currentBranch?: string
  worktrees: Worktree[]
}

export interface WorktreeClassification {
  path: string
  isGit: boolean
  isWorktree: boolean
  repoPath?: string
}

export interface CreateWorktreeResult {
  path: string
  branch: string
  baseRef: string
}

/** The sessions service face (`ctx.sessions`). */
export type SessionsService = ISessions

/** Minimal connection face the worktree API needs from `ctx.connection`. */
export interface ConnectionService {
  rpc: {
    call(channel: string, endpoint: string, payload?: unknown, signal?: AbortSignal): Promise<unknown>
  }
}

/** The workspace service face (`ctx.workspaces`). */
export type WorkspacesService = IWorkspaces
