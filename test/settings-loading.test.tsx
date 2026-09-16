// @vitest-environment jsdom
import { t } from "../src/client/lib/i18n"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorktreesSettings } from "../src/client/components/WorktreesSettings"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function repository(path: string, linked = false) {
  return {
    repoPath: path,
    commonDir: `${path}/.git`,
    worktrees: [
      { path, branch: "main", isMain: true, detached: false, locked: false, prunable: false },
      ...(linked ? [{ path: `${path}.worktrees/task`, branch: "task", isMain: false, detached: false, locked: false, prunable: false }] : []),
    ],
  }
}

function setup() {
  const api = { scan: vi.fn(), status: vi.fn(), remove: vi.fn(), prune: vi.fn() }
  const items = [
    { workspaceId: "broad", path: "/projects", title: "Projects" },
    { workspaceId: "narrow", path: "/projects/narrow", title: "Narrow" },
  ]
  const workspaces: any = {
    list: { getSnapshot: () => ({ items }), subscribe: () => () => {} },
    create: vi.fn(), rename: vi.fn(), delete: vi.fn(),
  }
  const sessions: any = { open: vi.fn() }
  const onCreate = vi.fn()
  const mount = () => render(<WorktreesSettings api={api} workspaces={workspaces} sessions={sessions} onCreate={onCreate} />)
  return { api, workspaces, onCreate, mount }
}

afterEach(cleanup)

describe("WorktreesSettings loading lifecycle", () => {
  it("shows explicit loading until scan settles, then offers creation for a repository with zero linked worktrees", async () => {
    const next = setup()
    const scan = deferred<any[]>()
    next.api.scan.mockReturnValue(scan.promise)
    next.mount()
    expect(screen.getByRole("status").textContent).toContain(t("scanning"))
    expect(screen.queryByText(t("noWorktrees"))).toBeNull()
    expect(screen.getByRole("button", { name: t("refresh") })).toHaveProperty("disabled", true)
    expect(next.api.scan).toHaveBeenCalledWith(["/projects", "/projects/narrow"], expect.any(AbortSignal))

    await act(async () => { scan.resolve([repository("/projects/empty")]) })
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByRole("heading", { name: "empty" })).toBeTruthy()
    expect(document.querySelectorAll(".dswt-worktree")).toHaveLength(0)
    expect(next.api.status).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: t("createWorktree") }))
    expect(next.onCreate).toHaveBeenCalledExactlyOnceWith({ path: "/projects/empty", title: "empty" })
    expect(next.workspaces.create).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: t("refresh") })).toHaveProperty("disabled", false)
  })

  it("renders repository/create actions before linked statuses settle and never checks main repositories", async () => {
    const next = setup()
    const scan = deferred<any[]>()
    const status = deferred<any>()
    next.api.scan.mockReturnValue(scan.promise)
    next.api.status.mockReturnValue(status.promise)
    next.mount()
    await act(async () => { scan.resolve([repository("/projects/empty"), repository("/projects/linked", true)]) })

    expect(screen.getAllByRole("button", { name: t("createWorktree") })).toHaveLength(2)
    expect(screen.getByText(t("checkingStatus"))).toBeTruthy()
    expect(screen.queryByText(t("clean"))).toBeNull()
    expect(screen.getByRole("status")).toBeTruthy()
    expect(screen.getByRole("button", { name: t("remove") })).toHaveProperty("disabled", true)
    expect(next.api.status.mock.calls).toEqual([["/projects/linked.worktrees/task", next.api.scan.mock.calls[0][1]]])

    await act(async () => { status.resolve({ changedFiles: 0, branchLine: "", output: "" }) })
    expect(screen.getByText(t("clean"))).toBeTruthy()
    expect(screen.queryByText(t("checkingStatus"))).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByRole("button", { name: t("remove") })).toHaveProperty("disabled", false)
  })

  it("aborts an outstanding scan on unmount and ignores its late result", async () => {
    const next = setup()
    const scan = deferred<any[]>()
    next.api.scan.mockReturnValue(scan.promise)
    const view = next.mount()
    const signal = next.api.scan.mock.calls[0][1] as AbortSignal
    expect(signal.aborted).toBe(false)
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { scan.resolve([repository("/stale", true)]) })
    expect(next.api.status).not.toHaveBeenCalled()
  })

  it("aborts pending linked status checks on unmount", async () => {
    const next = setup()
    const status = deferred<any>()
    next.api.scan.mockResolvedValue([repository("/projects/linked", true)])
    next.api.status.mockReturnValue(status.promise)
    const view = next.mount()
    await waitFor(() => expect(next.api.status).toHaveBeenCalledTimes(1))
    const signal = next.api.status.mock.calls[0][1] as AbortSignal
    expect(signal.aborted).toBe(false)
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { status.reject(new Error("late cancellation")) })
  })

  it("aborts the prior scan on scope change and does not let stale results replace the selected repository", async () => {
    const next = setup()
    const oldScan = deferred<any[]>()
    const newScan = deferred<any[]>()
    next.api.scan.mockReturnValueOnce(oldScan.promise).mockReturnValueOnce(newScan.promise)
    next.mount()
    const oldSignal = next.api.scan.mock.calls[0][1] as AbortSignal
    fireEvent.change(screen.getByRole("combobox", { name: t("scanScope") }), { target: { value: "/projects/narrow" } })
    expect(oldSignal.aborted).toBe(true)
    expect(next.api.scan).toHaveBeenLastCalledWith(["/projects/narrow"], expect.any(AbortSignal))
    expect(next.api.scan.mock.calls[1][1].aborted).toBe(false)
    await act(async () => { newScan.resolve([repository("/projects/narrow")]) })
    await act(async () => { oldScan.resolve([repository("/stale", true)]) })
    expect(screen.getByRole("heading", { name: "narrow" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "stale" })).toBeNull()
    expect(next.api.status).not.toHaveBeenCalled()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("aborts previous status checks on scope change and ignores their late failure", async () => {
    const next = setup()
    const status = deferred<any>()
    const newScan = deferred<any[]>()
    next.api.scan.mockResolvedValueOnce([repository("/old", true)]).mockReturnValueOnce(newScan.promise)
    next.api.status.mockReturnValue(status.promise)
    next.mount()
    await waitFor(() => expect(next.api.status).toHaveBeenCalledTimes(1))
    const signal = next.api.status.mock.calls[0][1] as AbortSignal
    fireEvent.change(screen.getByRole("combobox", { name: t("scanScope") }), { target: { value: "/projects/narrow" } })
    expect(signal.aborted).toBe(true)
    await act(async () => { newScan.resolve([repository("/projects/narrow")]) })
    await act(async () => { status.reject(new Error("stale status failed")) })
    expect(screen.getByRole("heading", { name: "narrow" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "old" })).toBeNull()
    expect(screen.queryByText("stale status failed")).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("clears loading and exposes a rejected scan instead of remaining stuck", async () => {
    const next = setup()
    const scan = deferred<any[]>()
    next.api.scan.mockReturnValue(scan.promise)
    next.mount()
    await act(async () => { scan.reject(new Error("Worktree request timed out")) })
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByRole("alert").textContent).toContain("Worktree request timed out")
    expect(screen.getByRole("button", { name: t("refresh") })).toHaveProperty("disabled", false)
  })
})
