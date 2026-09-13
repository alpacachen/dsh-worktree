// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CreateWorktreeDialog } from "../src/client/components/CreateWorktreeDialog"
import { t } from "../src/client/lib/i18n"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const repository = {
  repoPath: "/repo",
  commonDir: "/repo/.git",
  defaultBranch: "main",
  defaultRef: "origin/main",
  worktrees: [{ path: "/repo", branch: "feature", isMain: true, detached: false, locked: false, prunable: false }],
}
const created = { path: "/repo.worktrees/fix-login", branch: "task/fix-login", baseRef: "feature" }

function setup() {
  const api = {
    list: vi.fn().mockResolvedValue(repository),
    create: vi.fn().mockResolvedValue(created),
    remove: vi.fn().mockResolvedValue({ removed: true, path: created.path }),
  }
  const workspaces = {
    create: vi.fn().mockResolvedValue({ workspaceId: "ws-task", path: created.path, title: "fix-login" }),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
  const sessions = { create: vi.fn().mockResolvedValue("session-task"), open: vi.fn() }
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const mount = () => render(<CreateWorktreeDialog target={{ path: "/repo", title: "App" }} api={api as any} workspaces={workspaces as any} sessions={sessions as any} onClose={onClose} onCreated={onCreated} />)
  return { api, workspaces, sessions, onClose, onCreated, mount }
}
const nameField = () => screen.getByRole("textbox", { name: t("taskName") })
const submit = () => screen.getByRole("button", { name: t("createAndOpen") })
const form = () => document.querySelector("form")!
const ready = () => screen.findByRole("textbox", { name: t("taskName") })

afterEach(cleanup)

describe("native worktree create flow", () => {
  it("shows repository context, live normalized preview, and submits with Enter", async () => {
    const next = setup()
    next.mount()
    const user = userEvent.setup()
    await ready()
    expect(screen.getByText("App")).toBeTruthy()
    expect(screen.getByText("/repo")).toBeTruthy()
    expect(submit()).toHaveProperty("disabled", true)
    const input = nameField()
    expect(input.id).not.toBe("")
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(t("taskName"))
    await user.type(input, "Fix login")
    expect(screen.getByText("task/fix-login")).toBeTruthy()
    expect(screen.getByText(created.path)).toBeTruthy()
    expect(document.querySelector(".dswt-preview")?.getAttribute("aria-live")).toBe("polite")
    await user.keyboard("{Enter}")
    await waitFor(() => expect(next.sessions.open).toHaveBeenCalledExactlyOnceWith("session-task"))
    expect(next.api.create).toHaveBeenCalledExactlyOnceWith({ repoPath: "/repo", path: created.path, branch: "task/fix-login", baseRef: "feature" })
    expect(next.workspaces.rename).toHaveBeenCalledWith("ws-task", "App/fix-login")
    expect(next.onCreated).toHaveBeenCalledWith(created.path)
    expect(next.onClose).toHaveBeenCalledTimes(1)
  })

  it("retains accessible radios and uses the selected main ref", async () => {
    const next = setup()
    next.mount()
    await ready()
    const current = screen.getByRole("radio", { name: new RegExp(t("currentBranch")) })
    const main = screen.getByRole("radio", { name: new RegExp(t("mainBranch")) })
    expect(current).toHaveProperty("checked", true)
    expect(current.getAttribute("name")).toBe(main.getAttribute("name"))
    expect(current.id).not.toBe(main.id)
    fireEvent.click(main)
    fireEvent.change(nameField(), { target: { value: "Fix login" } })
    fireEvent.submit(form())
    await waitFor(() => expect(next.api.create).toHaveBeenCalledWith(expect.objectContaining({ baseRef: "origin/main" })))
  })

  it.each(["", "   ", "!!!", ".hidden", "a..b", "task.", "task.lock"])("rejects invalid name %j, including direct form submission", async (name) => {
    const next = setup()
    next.mount()
    await ready()
    fireEvent.change(nameField(), { target: { value: name } })
    expect(submit()).toHaveProperty("disabled", true)
    fireEvent.submit(form())
    expect(next.api.create).not.toHaveBeenCalled()
    expect(screen.queryByText(/^task\//)).toBeNull()
    expect(screen.getByRole("alert").textContent).toBe(t(name.trim() ? "invalidTaskName" : "fillTaskName"))
  })

  it("shows a loading skeleton, disables creation, and retries a failed initial list", async () => {
    const next = setup()
    const list = deferred<typeof repository>()
    next.api.list.mockReturnValueOnce(list.promise)
    next.mount()
    expect(screen.getByRole("status").textContent).toContain(t("loadingRepository"))
    expect(document.querySelectorAll(".dswt-dialog-loading > span[aria-hidden]")).toHaveLength(3)
    expect(submit()).toHaveProperty("disabled", true)
    fireEvent.submit(form())
    expect(next.api.create).not.toHaveBeenCalled()
    await act(async () => { list.reject(new Error("Connection interrupted")) })
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByRole("alert").textContent).toContain("Connection interrupted")
    expect(submit()).toHaveProperty("disabled", true)
    fireEvent.click(screen.getByRole("button", { name: t("retry") }))
    await ready()
    expect(next.api.list).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("ignores a late initial-list result after unmount", async () => {
    const next = setup()
    const list = deferred<typeof repository>()
    next.api.list.mockReturnValueOnce(list.promise)
    const view = next.mount()
    view.unmount()
    await act(async () => { list.resolve(repository) })
    expect(next.api.create).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("blocks duplicate submits, close button, cancel, Escape and outside dismissal while busy", async () => {
    const next = setup()
    const pending = deferred<typeof created>()
    next.api.create.mockReturnValueOnce(pending.promise)
    next.mount()
    await ready()
    const user = userEvent.setup()
    fireEvent.change(nameField(), { target: { value: "Fix login" } })
    act(() => { fireEvent.submit(form()); fireEvent.submit(form()) })
    expect(next.api.create).toHaveBeenCalledTimes(1)
    expect(nameField()).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: t("close") })).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: t("cancel") })).toHaveProperty("disabled", true)
    await user.click(screen.getByRole("button", { name: t("close") }))
    await user.click(screen.getByRole("button", { name: t("cancel") }))
    await user.keyboard("{Escape}")
    fireEvent.pointerDown(document.querySelector(".dswt-dialog-overlay")!)
    expect(next.onClose).not.toHaveBeenCalled()
    await act(async () => { pending.resolve(created) })
    expect(next.onClose).toHaveBeenCalledTimes(1)
  })

  it("retries registration without re-creating the worktree and guards recovery while busy", async () => {
    const next = setup()
    const registration = deferred<{ workspaceId: string; path: string; title: string }>()
    next.workspaces.create.mockRejectedValueOnce(new Error("Workspace service unavailable")).mockReturnValueOnce(registration.promise)
    next.mount()
    await ready()
    fireEvent.change(nameField(), { target: { value: "Fix login" } })
    fireEvent.submit(form())
    const retry = await screen.findByRole("button", { name: t("retryRegister") })
    expect(screen.getByRole("alert").textContent).toContain(t("registerFailed"))
    expect(nameField()).toHaveProperty("disabled", true)
    expect(screen.getByText(created.path)).toBeTruthy()
    expect(screen.queryByRole("button", { name: t("createAndOpen") })).toBeNull()
    // A programmatic submit must not escape the recovery-only flow.
    fireEvent.submit(form())
    act(() => { fireEvent.click(retry); fireEvent.click(retry) })
    expect(next.workspaces.create).toHaveBeenCalledTimes(2)
    expect(next.api.create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: t("cleanupCreated") })).toHaveProperty("disabled", true)
    expect(screen.getByRole("button", { name: t("close") })).toHaveProperty("disabled", true)
    await act(async () => { registration.resolve({ workspaceId: "ws-retry", path: created.path, title: "fix-login" }) })
    expect(next.workspaces.rename).toHaveBeenCalledWith("ws-retry", "App/fix-login")
    expect(next.sessions.open).toHaveBeenCalledExactlyOnceWith("session-task")
    expect(next.api.create).toHaveBeenCalledTimes(1)
  })

  it("preserves cleanup recovery after failure and closes only after removal succeeds", async () => {
    const next = setup()
    next.workspaces.create.mockRejectedValue(new Error("Registration unavailable"))
    next.api.remove.mockRejectedValueOnce(new Error("Worktree is locked"))
    next.mount()
    await ready()
    fireEvent.change(nameField(), { target: { value: "Fix login" } })
    fireEvent.submit(form())
    fireEvent.click(await screen.findByRole("button", { name: t("cleanupCreated") }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Worktree is locked"))
    expect(next.onClose).not.toHaveBeenCalled()
    expect(screen.getByText(created.path)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: t("cleanupCreated") }))
    await waitFor(() => expect(next.onClose).toHaveBeenCalledTimes(1))
    expect(next.api.remove).toHaveBeenCalledWith({ repoPath: "/repo", path: created.path })
    expect(next.api.create).toHaveBeenCalledTimes(1)
    expect(next.sessions.open).not.toHaveBeenCalled()
  })

  it("rolls back partial Workspace registration on both initial failure and retry failure", async () => {
    const next = setup()
    next.workspaces.rename.mockRejectedValue(new Error("Rename unavailable"))
    next.mount()
    await ready()
    fireEvent.change(nameField(), { target: { value: "Fix login" } })
    fireEvent.submit(form())
    fireEvent.click(await screen.findByRole("button", { name: t("retryRegister") }))
    await waitFor(() => expect(next.workspaces.delete).toHaveBeenCalledTimes(2))
    expect(next.api.create).toHaveBeenCalledTimes(1)
    expect(next.api.remove).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: t("retryRegister") })).toBeTruthy()
    expect(next.onClose).not.toHaveBeenCalled()
  })
})
