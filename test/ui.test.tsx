// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CreateWorktreeDialog } from "../src/client/components/CreateWorktreeDialog"

const target = { workspaceId: "ws-main", path: "/repo", title: "apple" }

function services() {
  return {
    workspaces: {
      create: vi.fn().mockResolvedValue({ workspaceId: "ws-wt", path: "/repo.worktrees/fix-login", title: "fix-login" }),
      rename: vi.fn().mockResolvedValue(undefined),
      connectWorkspace: vi.fn().mockResolvedValue("session-wt"),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    sessions: { open: vi.fn() },
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
    render(<CreateWorktreeDialog target={target} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions} onCreated={vi.fn()} onClose={onClose} />)

    await waitFor(() => expect(screen.getByRole("radio", { name: /当前分支/ })).toBeTruthy())
    expect(screen.getByText("apple Worktree")).toBeTruthy()
    expect(screen.getByRole("radio", { name: /主分支/ })).toBeTruthy()
    expect(screen.queryByText(/新分支|目录/)).toBeNull()
    await user.type(screen.getByLabelText("名称"), "Fix login")
    await user.click(screen.getByRole("button", { name: "创建并打开" }))

    await waitFor(() => expect(next.sessions.open).toHaveBeenCalledWith("session-wt"))
    expect(api.create).toHaveBeenCalledWith({ repoPath: "/repo", path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "main" })
    expect(next.workspaces.rename).toHaveBeenCalledWith("ws-wt", "apple/fix-login")
    expect(next.workspaces.connectWorkspace).toHaveBeenCalledWith("ws-wt")
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
    render(<CreateWorktreeDialog target={{ workspaceId: "ws-feature", path: "/repo.worktrees/feature", title: "feature" }} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions} onCreated={vi.fn()} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole("radio", { name: /当前分支/ })).toBeTruthy())
    expect(screen.getByText("main")).toBeTruthy()
    await user.click(screen.getByRole("radio", { name: /主分支/ }))
    await user.type(screen.getByLabelText("名称"), "Fix login")
    await user.click(screen.getByRole("button", { name: "创建并打开" }))

    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ repoPath: "/repo", path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "main" }))
  })

  it("shows a validation message without calling the host", async () => {
    const next = services()
    const api = { list: vi.fn().mockResolvedValue({ repoPath: "/repo", commonDir: "/repo/.git", worktrees: [] }), create: vi.fn(), remove: vi.fn() }
    render(<CreateWorktreeDialog target={target} api={api as any} workspaces={next.workspaces as any} sessions={next.sessions} onCreated={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole("radio", { name: /当前分支/ })).toBeTruthy())
    expect(screen.getByRole("radio", { name: /主分支/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: "创建并打开" })).toHaveProperty("disabled", true)
    expect(api.create).not.toHaveBeenCalled()
  })
})
