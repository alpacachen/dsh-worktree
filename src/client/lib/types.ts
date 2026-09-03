import type { ReactNode } from "react"

export interface Workspace {
  workspaceId: string
  path: string
  title: string
  sessionIds?: string[]
}

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

export interface WorkspaceExtensions {
  register(definition: {
    id: string
    menuItem?: (workspace: Workspace) => {
      id: string
      label: string
      icon?: ReactNode
      order?: number
      onSelect?: () => void | Promise<void>
    } | undefined
    deleteWorkspace?: (workspace: Workspace) => void | Promise<void> | undefined
    icon?: (workspace: Workspace, state: { expanded: boolean; active: boolean }) => ReactNode | undefined
  }): () => void
  invalidate(): void
}

export interface WorkspacesService {
  list: {
    getSnapshot(): { items: Workspace[] }
    subscribe(listener: () => void): () => void
  }
  create(input: { path: string }): Promise<Workspace>
  rename(workspaceId: string, title: string): Promise<unknown>
  connectWorkspace(workspaceId: string): Promise<string>
  delete(workspaceId: string): Promise<void>
}

export interface SessionsService {
  open(sessionId: string): void
}

export interface ConnectionService {
  rpc: {
    call(channel: string, endpoint: string, payload?: unknown, signal?: AbortSignal): Promise<unknown>
  }
}
