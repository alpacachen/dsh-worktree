// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorktreesSettings } from "../src/client/components/WorktreesSettings"

const clean = { changedFiles: 0, branchLine: "", output: "" }
const linkedPath = "/projects/alpha.worktrees/task"
function worktree(path: string, branch: string, extra = {}) {
  return { path, branch, isMain: false, detached: false, locked: false, prunable: false, ...extra }
}
function repository(name: string, rows: ReturnType<typeof worktree>[] = []) {
  const repoPath = `/projects/${name}`
  return { repoPath, commonDir: `${repoPath}/.git`, worktrees: [worktree(repoPath, `main-${name}`, { isMain: true }), ...rows] }
}
function setup({ repos = [repository("alpha", [worktree(linkedPath, "task/feature")])], items = [] as any[] } = {}) {
  const api = {
    scan: vi.fn().mockResolvedValue(repos),
    status: vi.fn().mockImplementation(async (path: string) => ({ ...clean, changedFiles: path.includes("dirty") ? 2 : 0 })),
    remove: vi.fn().mockResolvedValue({}),
    prune: vi.fn().mockResolvedValue({}),
  }
  const workspaces = {
    list: { getSnapshot: () => ({ items }), subscribe: () => () => {} },
    create: vi.fn().mockResolvedValue({ workspaceId: "new-workspace", path: linkedPath, title: "" }),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
  const sessions = { create: vi.fn().mockResolvedValue("new-session"), open: vi.fn() }
  const onCreate = vi.fn()
  const close = vi.fn()
  const mount = () => render(<WorktreesSettings api={api} workspaces={workspaces as any} sessions={sessions as any} onCreate={onCreate} close={close} />)
  return { api, workspaces, sessions, onCreate, close, mount }
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("button", { name: "刷新" })).toHaveProperty("disabled", false))
}
function repoArticle(name: string) {
  return within(screen.getByRole("heading", { name }).closest("article")!)
}
function visibleRepositories() {
  return screen.queryAllByRole("heading", { level: 3 }).map(node => node.textContent)
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("WorktreesSettings discovery controls", () => {
  const repos = [
    repository("alpha", [worktree(linkedPath, "task/feature")]),
    repository("beta", [worktree("/external/dirty-checkout", "fix/payments")]),
    repository("empty"),
  ]

  it.each([
    ["ALPHA", "alpha"],
    ["fix/payments", "beta"],
    ["/external/dirty-checkout", "beta"],
    ["main-empty", "empty"],
  ])("searches repository, linked/current branch and path using %s", async (query, expected) => {
    const user = userEvent.setup()
    const next = setup({ repos })
    next.mount()
    await settled()
    await user.type(screen.getByRole("textbox", { name: "搜索仓库、分支或路径" }), query)
    expect(visibleRepositories()).toEqual([expected])
    expect(next.api.scan).toHaveBeenCalledTimes(1)
    expect(next.workspaces.create).not.toHaveBeenCalled()
  })

  it("filters all, linked and attention repositories and clears query plus filter from the empty state", async () => {
    const user = userEvent.setup()
    const next = setup({ repos })
    next.mount()
    await settled()
    const filters = within(screen.getByRole("group", { name: "Worktree 管理" }))
    expect(filters.getByRole("button", { name: "全部" }).getAttribute("aria-pressed")).toBe("true")
    expect(visibleRepositories()).toEqual(["alpha", "beta", "empty"])
    await user.click(filters.getByRole("button", { name: "有 Worktree" }))
    expect(visibleRepositories()).toEqual(["alpha", "beta"])
    expect(filters.getByRole("button", { name: "有 Worktree" }).getAttribute("aria-pressed")).toBe("true")
    await user.click(filters.getByRole("button", { name: "需留意" }))
    expect(visibleRepositories()).toEqual(["beta"])
    expect(filters.getByRole("button", { name: "需留意" }).getAttribute("aria-pressed")).toBe("true")
    const search = screen.getByRole("textbox", { name: "搜索仓库、分支或路径" })
    await user.type(search, "no-match")
    const emptyState = screen.getByRole("heading", { name: "没有匹配的项目" }).parentElement!
    // A separate clear-query icon also exists in the search box.
    await user.click(within(emptyState).getByRole("button", { name: "清除筛选" }))
    expect(search).toHaveProperty("value", "")
    expect(filters.getByRole("button", { name: "全部" }).getAttribute("aria-pressed")).toBe("true")
    expect(visibleRepositories()).toEqual(["alpha", "beta", "empty"])
    expect(next.api.scan).toHaveBeenCalledTimes(1)
  })

  it("includes locked, prunable and failed-status worktrees in attention, but excludes clean repositories", async () => {
    const next = setup({ repos: [
      repository("locked", [worktree("/locked", "locked-task", { locked: true })]),
      repository("prunable", [worktree("/prunable", "prunable-task", { prunable: true })]),
      repository("failed", [worktree("/failed", "failed-task")]),
      repository("clean", [worktree("/clean", "clean-task")]),
    ] })
    next.api.status.mockImplementation(async path => {
      if (path === "/failed") throw new Error("status unavailable")
      return clean
    })
    next.mount()
    await settled()
    await userEvent.setup().click(screen.getByRole("button", { name: "需留意" }))
    expect(visibleRepositories()).toEqual(["locked", "prunable", "failed"])
  })

  it("collapses and expands each repository with accessible state without rescanning", async () => {
    const next = setup({ repos })
    next.mount()
    await settled()
    const user = userEvent.setup()
    const collapse = screen.getByRole("button", { name: "收起仓库 alpha" })
    expect(collapse.getAttribute("aria-expanded")).toBe("true")
    await user.click(collapse)
    expect(screen.queryByText("task/feature")).toBeNull()
    expect(screen.getByText("fix/payments")).toBeTruthy()
    const expand = screen.getByRole("button", { name: "展开仓库 alpha" })
    expect(expand.getAttribute("aria-expanded")).toBe("false")
    await user.click(expand)
    expect(screen.getByText("task/feature")).toBeTruthy()
    expect(screen.getByRole("button", { name: "收起仓库 alpha" }).getAttribute("aria-expanded")).toBe("true")
    expect(next.api.scan).toHaveBeenCalledTimes(1)
  })

  it("creates from the selected repository, including one without linked worktrees", async () => {
    const next = setup({ repos })
    next.mount()
    await settled()
    const user = userEvent.setup()
    for (const name of ["alpha", "beta", "empty"]) {
      await user.click(repoArticle(name).getByRole("button", { name: "创建 worktree" }))
      expect(next.onCreate).toHaveBeenLastCalledWith({ path: `/projects/${name}`, title: name })
    }
    expect(next.onCreate).toHaveBeenCalledTimes(3)
    expect(next.workspaces.create).not.toHaveBeenCalled()
  })
})

describe("WorktreesSettings safe removal", () => {
  it("uses an in-app confirmation with the target and branch-preservation message; cancellation performs no mutation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    const next = setup()
    next.mount()
    await settled()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "删除 Worktree" }))
    const dialog = screen.getByRole("dialog", { name: "删除这个 Worktree？" })
    expect(within(dialog).getByText(linkedPath)).toBeTruthy()
    expect(within(dialog).getByText("task/feature")).toBeTruthy()
    expect(within(dialog).getByText("保留 Git 分支")).toBeTruthy()
    expect(next.api.remove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "取消" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
    expect(next.api.status).toHaveBeenCalledTimes(1)
    expect(next.api.remove).not.toHaveBeenCalled()
    expect(next.api.prune).not.toHaveBeenCalled()
    expect(next.workspaces.delete).not.toHaveBeenCalled()
    expect(next.workspaces.create).not.toHaveBeenCalled()
  })

  it("rechecks status before removing a clean worktree and deleting only its registered workspace", async () => {
    const next = setup({ items: [{ workspaceId: "linked", path: linkedPath, title: "Feature" }] })
    next.mount()
    await settled()
    let resolveStatus!: (value: typeof clean) => void
    next.api.status.mockImplementationOnce(() => new Promise(resolve => { resolveStatus = resolve }))
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "删除 Worktree" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "确认删除" }))
    expect(next.api.status).toHaveBeenLastCalledWith(linkedPath)
    expect(next.api.remove).not.toHaveBeenCalled()
    expect(next.workspaces.delete).not.toHaveBeenCalled()
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "正在删除…" })).toHaveProperty("disabled", true)
    await act(async () => { resolveStatus(clean) })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(next.api.remove).toHaveBeenCalledExactlyOnceWith({ repoPath: "/projects/alpha", path: linkedPath })
    expect(next.workspaces.delete).toHaveBeenCalledExactlyOnceWith("linked")
    expect(next.api.remove.mock.invocationCallOrder[0]).toBeLessThan(next.workspaces.delete.mock.invocationCallOrder[0])
    expect(next.api.scan).toHaveBeenCalledTimes(2)
  })

  it.each([
    ["dirty", { locked: false }, "请先提交或保存更改，再删除 Worktree。"],
    ["locked", { locked: true }, "请先解锁这个 Worktree。"],
  ])("disables removal for %s worktrees with an explanation", async (name, extra, title) => {
    const next = setup({ repos: [repository("alpha", [worktree(`/projects/${name}`, name, extra)])] })
    next.mount()
    await settled()
    const remove = screen.getByRole("button", { name: "删除 Worktree" })
    expect(remove).toHaveProperty("disabled", true)
    expect(remove.title).toBe(title)
    await userEvent.setup().click(remove)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(next.api.remove).not.toHaveBeenCalled()
    expect(next.workspaces.delete).not.toHaveBeenCalled()
  })

  it.each(["changed", "remove-error"])("keeps %s failures in the confirmation dialog without deleting the workspace", async failure => {
    const next = setup({ items: [{ workspaceId: "linked", path: linkedPath, title: "Feature" }] })
    next.mount()
    await settled()
    if (failure === "changed") next.api.status.mockResolvedValueOnce({ ...clean, changedFiles: 1 })
    else next.api.remove.mockRejectedValueOnce(new Error("disk removal failed"))
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "删除 Worktree" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "确认删除" }))
    const dialog = within(screen.getByRole("dialog", { name: "删除这个 Worktree？" }))
    await waitFor(() => expect(dialog.getByRole("alert").textContent).toContain(failure === "changed" ? "状态已变化" : "disk removal failed"))
    expect(dialog.getByRole("button", { name: "确认删除" })).toHaveProperty("disabled", false)
    expect(next.workspaces.delete).not.toHaveBeenCalled()
    if (failure === "changed") expect(next.api.remove).not.toHaveBeenCalled()
    else expect(next.api.remove).toHaveBeenCalledExactlyOnceWith({ repoPath: "/projects/alpha", path: linkedPath })
    expect(next.api.scan).toHaveBeenCalledTimes(1)
  })
})

describe("WorktreesSettings open session", () => {
  it.each([true, false])("opens a session and closes settings for an existing workspace: %s", async existing => {
    const next = setup({ items: existing ? [{ workspaceId: "existing", path: `${linkedPath}/`, title: "Existing title" }] : [] })
    next.mount()
    await settled()
    await userEvent.setup().click(screen.getByRole("button", { name: "打开会话" }))
    await waitFor(() => expect(next.close).toHaveBeenCalledExactlyOnceWith())
    expect(next.sessions.create).toHaveBeenCalledExactlyOnceWith({ workspaceId: existing ? "existing" : "new-workspace" })
    expect(next.sessions.open).toHaveBeenCalledExactlyOnceWith("new-session")
    expect(next.sessions.create.mock.invocationCallOrder[0]).toBeLessThan(next.sessions.open.mock.invocationCallOrder[0])
    expect(next.sessions.open.mock.invocationCallOrder[0]).toBeLessThan(next.close.mock.invocationCallOrder[0])
    if (existing) {
      expect(next.workspaces.create).not.toHaveBeenCalled()
      expect(next.workspaces.rename).not.toHaveBeenCalled()
    } else {
      expect(next.workspaces.create).toHaveBeenCalledExactlyOnceWith({ path: linkedPath })
      expect(next.workspaces.rename).toHaveBeenCalledExactlyOnceWith("new-workspace", "alpha/task/feature")
      expect(next.workspaces.rename.mock.invocationCallOrder[0]).toBeLessThan(next.sessions.create.mock.invocationCallOrder[0])
    }
    expect(next.api.remove).not.toHaveBeenCalled()
    expect(next.workspaces.delete).not.toHaveBeenCalled()
  })
})
