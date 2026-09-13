import { afterEach, describe, expect, it, vi } from "vitest"
import { createWorktreeApi } from "../src/client/lib/api"

describe("worktree client API routing", () => {
  const createPayload = { repoPath: "/repo", path: "/repo.worktrees/task", branch: "task", baseRef: "main" }
  const removePayload = { repoPath: "/repo", path: "/repo.worktrees/task" }

  afterEach(() => vi.useRealTimers())

  it.each(["list", "scan", "classify", "status"] as const)("bounds never-resolving %s reads to 15 seconds and aborts transport", async operation => {
    vi.useFakeTimers()
    const call = vi.fn().mockImplementation(() => new Promise<never>(() => {}))
    const api = createWorktreeApi({ rpc: { call } })
    const invoke = api[operation] as (argument: any) => Promise<unknown>
    const request = invoke(operation === "scan" ? ["/repo"] : "/repo")
    const rejected = expect(request).rejects.toThrow(/timed out/)
    const signal = call.mock.calls[0][3] as AbortSignal
    expect(signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(14999)
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    expect(signal.aborted).toBe(true)
    expect(call).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["scan", "status"] as const)("cancels %s reads when the caller aborts", async operation => {
    vi.useFakeTimers()
    const call = vi.fn().mockImplementation(() => new Promise<never>(() => {}))
    const api = createWorktreeApi({ rpc: { call } })
    const controller = new AbortController()
    const request = operation === "scan" ? api.scan(["/repo"], controller.signal) : api.status("/repo", controller.signal)
    const rejected = expect(request).rejects.toThrow(/cancelled/)
    controller.abort()
    await rejected
    expect(call.mock.calls[0][3].aborted).toBe(true)
    expect(call).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(["list", "scan", "classify", "status"] as const)("clears the %s read timer after a successful response", async operation => {
    vi.useFakeTimers()
    const call = vi.fn().mockResolvedValue({ ok: true, value: [] })
    const api = createWorktreeApi({ rpc: { call } })
    const invoke = api[operation] as (argument: any) => Promise<unknown>
    await invoke(operation === "scan" ? ["/repo"] : "/repo")
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(30000)
    expect(call.mock.calls[0][3].aborted).toBe(false)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it.each([
    { operation: "create", argument: createPayload },
    { operation: "remove", argument: removePayload },
    { operation: "prune", argument: "/repo" },
  ] as const)("does not time out or automatically retry $operation mutations", async ({ operation, argument }) => {
    vi.useFakeTimers()
    let reject!: (reason: Error) => void
    const call = vi.fn().mockImplementation(() => new Promise((_, fail) => { reject = fail }))
    const api = createWorktreeApi({ rpc: { call } })
    const invoke = api[operation] as (argument: any) => Promise<unknown>
    const request = invoke(argument)
    const failure = new Error("connection closed after mutation")
    const rejected = expect(request).rejects.toBe(failure)
    expect(call.mock.calls[0]).toHaveLength(3)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60000)
    expect(call).toHaveBeenCalledTimes(1)
    reject(failure)
    await rejected
    await vi.advanceTimersByTimeAsync(60000)
    expect(call).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    { operation: "list", endpoint: "worktree.list", argument: "/repo", payload: { path: "/repo" } },
    { operation: "scan", endpoint: "worktree.scan", argument: ["/repo"], payload: { paths: ["/repo"] } },
    { operation: "classify", endpoint: "worktree.classify", argument: "/repo", payload: { path: "/repo" } },
    { operation: "create", endpoint: "worktree.create", argument: createPayload, payload: createPayload },
    { operation: "remove", endpoint: "worktree.remove", argument: removePayload, payload: removePayload },
    { operation: "status", endpoint: "worktree.status", argument: "/repo", payload: { path: "/repo" } },
    { operation: "prune", endpoint: "worktree.prune", argument: "/repo", payload: { path: "/repo" } },
  ] as const)("routes $operation through the shared /api channel", async ({ operation, endpoint, argument, payload }) => {
    const value = { response: endpoint }
    const call = vi.fn().mockResolvedValue({ ok: true, value })
    const api = createWorktreeApi({ rpc: { call } })
    const invoke = api[operation] as (argument: unknown) => Promise<unknown>

    await expect(invoke(argument)).resolves.toBe(value)
    const args = ["/api", `dsh-simple-worktree/${endpoint}`, payload]
    if (["list", "scan", "classify", "status"].includes(operation)) args.push(expect.any(AbortSignal))
    expect(call.mock.calls).toEqual([args])
  })

  it.each([
    { result: { ok: false, error: { code: "bad-request", message: "fatal: not a git repository" } }, message: "not-git-repository", code: "not-git-repository" },
    { result: { ok: false, error: { code: "bad-request", message: "No such file or directory" } }, message: "worktree-unavailable", code: "worktree-unavailable" },
    { result: { ok: false, error: { code: "cancelled", message: "The request was cancelled." } }, message: "The request was cancelled.", code: "cancelled" },
    { result: { ok: false, error: { code: "bad-request", message: "Invalid path" } }, message: "Invalid path", code: "bad-request" },
    { result: undefined, message: "worktree operation failed", code: undefined },
  ])("rejects unsuccessful results with $message", async ({ result, message, code }) => {
    const call = vi.fn().mockResolvedValue(result)
    const api = createWorktreeApi({ rpc: { call } })

    await expect(api.list("/repo")).rejects.toMatchObject({ message, code })
    expect(call.mock.calls).toEqual([["/api", "dsh-simple-worktree/worktree.list", { path: "/repo" }, expect.any(AbortSignal)]])
  })

  it("propagates transport failures without wrapping or retrying them", async () => {
    const error = new Error("connection closed")
    const call = vi.fn().mockRejectedValue(error)
    const api = createWorktreeApi({ rpc: { call } })

    await expect(api.list("/repo")).rejects.toBe(error)
    expect(call.mock.calls).toEqual([["/api", "dsh-simple-worktree/worktree.list", { path: "/repo" }, expect.any(AbortSignal)]])
  })
})
