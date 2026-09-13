// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CreateWorktreeDialog } from "../src/client/components/CreateWorktreeDialog"
import { NewSessionWorktreeButton } from "../src/client/components/NewSessionWorktreeButton"
import { WorktreesSettings } from "../src/client/components/WorktreesSettings"

const target = { workspaceId: "ws-main", path: "/repo", title: "apple" }

function services() {
  return {
    workspaces: {
      create: vi.fn().mockResolvedValue({ workspaceId: "ws-wt", path: "/repo.worktrees/fix-login", title: "fix-login" }),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    sessions: {
      create: vi.fn().mockResolvedValue("session-wt"),
      open: vi.fn(),
    },
  }
}

describe("CreateWorktreeDialog", () => {
  it("loads branches and creates, renames, connects and opens the new worktree", async () => {
    const user = userEvent.setup()
    const next = services()
    const api = {
      list: vi.fn().mockResolvedValue({ repoPath: "/repo", commonDir: "/repo/.git", worktrees: [{ path: "/repo", branch: "main", isMain: true, detached: false, locked: false, prunable: false }] }),
      create: vi.fn().mockResolvedValue({ path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "main" }),
      remove: vi.fn(),
    }
    const onClose = vi.fn()
    render(<CreateWorktreeDialog target={target as any} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions as any} onCreated={vi.fn()} onClose={onClose} />)

    await waitFor(() => expect(screen.getByRole("radio", { name: /当前分支/ })).toBeTruthy())
    expect(screen.getByRole("dialog", { name: "新建 Worktree" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: /主分支/ })).toBeTruthy()
    expect(screen.queryByText(/新分支|目录/)).toBeNull()
    await user.type(screen.getByLabelText("名称"), "Fix login")
    await user.click(screen.getByRole("button", { name: "创建并打开" }))

    await waitFor(() => expect(next.sessions.open).toHaveBeenCalledWith("session-wt"))
    expect(api.create).toHaveBeenCalledWith({ repoPath: "/repo", path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "main" })
    expect(next.workspaces.rename).toHaveBeenCalledWith("ws-wt", "apple/fix-login")
    expect(next.sessions.create).toHaveBeenCalledWith({ workspaceId: "ws-wt" })
    expect(onClose).toHaveBeenCalled()
  })

  it("uses the selected main branch as the base", async () => {
    const user = userEvent.setup()
    const next = services()
    const api = {
      list: vi.fn().mockResolvedValue({
        repoPath: "/repo",
        commonDir: "/repo/.git",
        defaultBranch: "main",
        worktrees: [
          { path: "/repo", branch: "feature", isMain: true, detached: false, locked: false, prunable: false },
          { path: "/repo.worktrees/feature", branch: "feature-task", isMain: false, detached: false, locked: false, prunable: false },
        ],
      }),
      create: vi.fn().mockResolvedValue({ path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "main" }),
      remove: vi.fn(),
    }
    render(<CreateWorktreeDialog target={{ workspaceId: "ws-feature" as any, path: "/repo.worktrees/feature", title: "feature" } as any} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions as any} onCreated={vi.fn()} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole("radio", { name: /当前分支/ })).toBeTruthy())
    expect(screen.getByText("main")).toBeTruthy()
    await user.click(screen.getByRole("radio", { name: /主分支/ }))
    await user.type(screen.getByLabelText("名称"), "Fix login")
    await user.click(screen.getByRole("button", { name: "创建并打开" }))

    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ repoPath: "/repo", path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "main" }))
  })

  it("defaults to the main branch for the new-session entry", async () => {
    const user = userEvent.setup()
    const next = services()
    const api = {
      list: vi.fn().mockResolvedValue({
        repoPath: "/repo",
        commonDir: "/repo/.git",
        defaultBranch: "main",
        defaultRef: "origin/main",
        worktrees: [{ path: "/repo", branch: "feature", isMain: true, detached: false, locked: false, prunable: false }],
      }),
      create: vi.fn().mockResolvedValue({ path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "origin/main" }),
      remove: vi.fn(),
    }
    render(<CreateWorktreeDialog target={target as any} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions as any} defaultBaseChoice="main" onCreated={vi.fn()} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole("radio", { name: /主分支/ })).toHaveProperty("checked", true))
    await user.type(screen.getByLabelText("名称"), "Fix login")
    await user.click(screen.getByRole("button", { name: "创建并打开" }))

    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ repoPath: "/repo", path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "origin/main" }))
  })

  it("shows a validation message without calling the host", async () => {
    const next = services()
    const api = { list: vi.fn().mockResolvedValue({ repoPath: "/repo", commonDir: "/repo/.git", worktrees: [] }), create: vi.fn(), remove: vi.fn() }
    render(<CreateWorktreeDialog target={target as any} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions as any} onCreated={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("radio", { name: /当前分支/ })).toBeTruthy())
    expect(screen.getByRole("radio", { name: /主分支/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: "创建并打开" })).toHaveProperty("disabled", true)
    expect(api.create).not.toHaveBeenCalled()
  })
})

describe("NewSessionWorktreeButton", () => {
  const workspace = { ...target, sessionIds: ["session-new"] }
  const useWorkspaces = <T,>(selector: (state: { items: Array<typeof workspace> }) => T) => selector({ items: [workspace] })

  it("opens the current workspace from a blank session", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<NewSessionWorktreeButton session={{ sessionId: "session-new" as any, blank: true }} useWorkspaces={useWorkspaces as any} onOpen={onOpen} />)

    await user.click(screen.getByRole("button", { name: "创建 worktree" }))
    expect(onOpen).toHaveBeenCalledWith(workspace)
  })

  it("stays hidden after the session is no longer blank", () => {
    render(<NewSessionWorktreeButton session={{ sessionId: "session-new" as any, blank: false }} useWorkspaces={useWorkspaces as any} onOpen={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "创建 worktree" })).toBeNull()
  })

  it("stays hidden when the workspace is not a Git repository", () => {
    render(<NewSessionWorktreeButton session={{ sessionId: "session-new" as any, blank: true }} useWorkspaces={useWorkspaces as any} canCreate={() => false} onOpen={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "创建 worktree" })).toBeNull()
  })
})

describe("WorktreesSettings", () => {
  function renderSettings(rows: any[], items: any[] = []) {
    const workspaces: any = { list: { getSnapshot: () => ({ items }), subscribe: () => () => {} }, create: vi.fn().mockResolvedValue({ workspaceId: "new", path: rows[1]?.path, title: "" }), rename: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) }
    const api: any = { list: vi.fn().mockResolvedValue({ repoPath: "/repo", worktrees: rows }), scan: vi.fn().mockResolvedValue([{ repoPath: "/repo", worktrees: rows }]), status: vi.fn().mockImplementation((path: string) => Promise.resolve({ changedFiles: path.includes("dirty") ? 1 : 0, branchLine: "", output: "" })), remove: vi.fn().mockResolvedValue({}), prune: vi.fn().mockResolvedValue({}) }
    const sessions: any = { open: vi.fn() }
    render(<WorktreesSettings api={api} workspaces={workspaces} sessions={sessions} />)
    return { api, workspaces, sessions }
  }

  it("groups linked worktrees without showing the main repository as a row", async () => {
    const next = renderSettings([{ path: "/repo", branch: "main", isMain: true, locked: false, prunable: false }, { path: "/repo.worktrees/feature", branch: "feature", isMain: false, locked: false, prunable: false }], [])
    await waitFor(() => expect(screen.getByText("feature")).toBeTruthy())
    expect(screen.getByText("当前分支")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "打开" })).toBeNull()
    expect([...document.querySelectorAll(".dswt-worktree-title")].some(node => node.textContent?.includes("main"))).toBe(false)
    expect(next.workspaces.create).not.toHaveBeenCalled()
  })

  it("protects dirty worktrees from removal", async () => {
    const next = renderSettings([{ path: "/repo", branch: "main", isMain: true, locked: false, prunable: false }, { path: "/repo.worktrees/dirty", branch: "dirty", isMain: false, locked: false, prunable: false }], [{ workspaceId: "main", path: "/repo", title: "repo" }])
    await waitFor(() => expect(screen.getByText("1 个文件更改")).toBeTruthy())
    const remove = screen.getByRole("button", { name: "删除 Worktree" })
    expect(remove).toHaveProperty("disabled", true)
    expect(remove.title).toBe("请先提交或保存更改，再删除 Worktree。")
    await userEvent.setup().click(remove)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(next.api.remove).not.toHaveBeenCalled()
    expect(next.workspaces.delete).not.toHaveBeenCalled()
  })
})
