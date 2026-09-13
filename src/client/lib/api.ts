import type { ConnectionService, CreateWorktreeResult, WorktreeClassification, WorktreeList, WorktreeStatus } from "./types"

export const CHANNEL = "/api"

function classifyError(code: unknown, message: string): string | undefined {
  if (code === "not-git-repository" || /not a git repository/i.test(message)) return "not-git-repository"
  if (code === "worktree-unavailable" || /is not a working tree|No such file or directory/i.test(message)) return "worktree-unavailable"
  return undefined
}

export function createWorktreeApi(connection: ConnectionService) {
  async function call<T>(endpoint: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const args = [CHANNEL, `dsh-simple-worktree/${endpoint}`, payload] as const
    const result = await (signal ? connection.rpc.call(...args, signal) : connection.rpc.call(...args)) as any
    if (!result?.ok) {
      const message = result?.error?.message ?? "worktree operation failed"
      const code = classifyError(result?.error?.code, message)
      const error = new Error(code ?? message)
      ;(error as Error & { code?: string }).code = code ?? result?.error?.code
      throw error
    }
    return result.value as T
  }

  // Bound read-only work. Mutating calls deliberately do not time out here:
  // a timeout must not encourage retrying a creation that may have succeeded.
  async function read<T>(endpoint: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController()
    const timeoutError = new Error('Worktree request timed out. Refresh or select a more specific Workspace.')
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort: () => void = () => {}
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => { controller.abort(); reject(new Error('Worktree request cancelled.')) }
      timer = setTimeout(() => { controller.abort(); reject(timeoutError) }, 15000)
      signal?.addEventListener('abort', onAbort, { once: true })
      if (signal?.aborted) onAbort()
    })
    try { return await Promise.race([call<T>(endpoint, payload, controller.signal), cancelled]) }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort) }
  }

  return {
    list: (path: string) => read<WorktreeList>("worktree.list", { path }),
    scan: (paths: string[], signal?: AbortSignal) => read<WorktreeList[]>("worktree.scan", { paths }, signal),
    classify: (path: string) => read<WorktreeClassification>("worktree.classify", { path }),
    create: (payload: { repoPath: string; path: string; branch: string; baseRef: string }) => call<CreateWorktreeResult>("worktree.create", payload),
    remove: (payload: { repoPath: string; path: string }) => call<{ removed: boolean; path: string }>("worktree.remove", payload),
    status: (path: string, signal?: AbortSignal) => read<WorktreeStatus>("worktree.status", { path }, signal),
    prune: (path: string) => call<{ pruned: boolean }>("worktree.prune", { path }),
  }
}
