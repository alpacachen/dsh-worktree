import type { ConnectionService, CreateWorktreeResult, WorktreeClassification, WorktreeList, WorktreeStatus } from "./types"

export const CHANNEL = "/dsh-simple-worktree"

function classifyError(code: unknown, message: string): string | undefined {
  if (code === "not-git-repository" || /not a git repository/i.test(message)) return "not-git-repository"
  if (code === "worktree-unavailable" || /is not a working tree|No such file or directory/i.test(message)) return "worktree-unavailable"
  return undefined
}

export function createWorktreeApi(connection: ConnectionService) {
  async function call<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const result = await connection.rpc.call(CHANNEL, endpoint, payload) as any
    if (!result?.ok) {
      const message = result?.error?.message ?? "worktree operation failed"
      const code = classifyError(result?.error?.code, message)
      const error = new Error(code ?? message)
      ;(error as Error & { code?: string }).code = code ?? result?.error?.code
      throw error
    }
    return result.value as T
  }

  return {
    list: (path: string) => call<WorktreeList>("worktree.list", { path }),
    classify: (path: string) => call<WorktreeClassification>("worktree.classify", { path }),
    create: (payload: { repoPath: string; path: string; branch: string; baseRef: string }) => call<CreateWorktreeResult>("worktree.create", payload),
    remove: (payload: { repoPath: string; path: string }) => call<{ removed: boolean; path: string }>("worktree.remove", payload),
    status: (path: string) => call<WorktreeStatus>("worktree.status", { path }),
    prune: (path: string) => call<{ pruned: boolean }>("worktree.prune", { path }),
  }
}
