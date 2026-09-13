// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import type { ComponentType } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorktreePlugin } from "../src/client/plugin"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

type Classification = { path: string; isGit: boolean; isWorktree: boolean }
const disposers: Array<() => void> = []
afterEach(() => {
  cleanup()
  for (const dispose of disposers.splice(0)) dispose()
})

function setup() {
  const workspace = { workspaceId: "ws-main", path: "/repo/", title: "repo", sessionIds: ["session-new"] }
  // Both workspace and locale snapshots stay identical while classification resolves.
  const snapshot = { items: [workspace] }
  const workspaceListeners = new Set<() => void>()
  const effects: Array<() => void> = []
  const requests: Array<ReturnType<typeof deferred<{ ok: true; value: Classification }>>> = []
  let Dock!: ComponentType<any>
  const useWorkspaces = vi.fn((selector: (state: typeof snapshot) => unknown) => selector(snapshot))
  const locale = {
    register: () => () => {},
    bind: () => (key: string) => key === "createWorktree" ? "Create worktree" : key,
    getSnapshot: () => "en",
    subscribe: vi.fn(() => () => {}),
  }
  const call = vi.fn(() => {
    const request = deferred<{ ok: true; value: Classification }>()
    requests.push(request)
    return request.promise
  })
  WorktreePlugin.apply({
    connection: { rpc: { call } },
    get: (name: string) => name === "locale" ? locale : undefined,
    workspaces: { list: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        workspaceListeners.add(listener)
        return () => { workspaceListeners.delete(listener) }
      },
    } },
    sessions: {},
    effect: (effect: () => (() => void)) => { effects.push(effect()) },
    slots: {
      inject: (_name: string, register: () => void) => register(),
      register: (slot: { name: string }, callback: ComponentType<any>) => {
        if (slot.name === "conversation.input.dock") Dock = callback
      },
    },
  } as any)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const effect of effects.reverse()) effect()
  }
  disposers.push(dispose)
  const element = <div data-slot="conversation.composer"><div><button aria-haspopup="menu">Workspace</button><div data-slot="conversation.hero.agentPreset" /></div><Dock session={{ sessionId: "session-new", blank: true }} useWorkspaces={useWorkspaces} /></div>
  return {
    element, useWorkspaces, call, workspaceListeners, dispose,
    refresh: () => { for (const listener of workspaceListeners) listener() },
    resolve: async (index: number, isGit: boolean, isWorktree: boolean) => {
      await act(async () => {
        requests[index].resolve({ ok: true, value: { path: "/repo", isGit, isWorktree } })
        await requests[index].promise
      })
    },
  }
}

const button = () => screen.queryByRole("button", { name: "Create worktree" })

describe("registered worktree dock classification reactivity", () => {
  it("shows the main Git button after deferred classification without workspace or locale changes", async () => {
    const host = setup()
    render(host.element)
    expect(button()).toBeNull()
    expect(host.call).toHaveBeenCalledTimes(1)
    expect(host.call.mock.calls[0].slice(0, 3)).toEqual(["/api", "dsh-simple-worktree/worktree.classify", { path: "/repo/" }])
    await host.resolve(0, true, false)
    expect(button()).not.toBeNull()
    expect(host.call).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["linked worktree", true, true],
    ["non-Git workspace", false, false],
  ] as const)("keeps the button hidden for a %s", async (_label, isGit, isWorktree) => {
    const host = setup()
    render(host.element)
    await host.resolve(0, isGit, isWorktree)
    expect(button()).toBeNull()
  })

  it.each([false, true])("ignores an obsolete classification when the latest isGit is %s", async (latestIsGit) => {
    const host = setup()
    render(host.element)
    act(() => host.refresh())
    await host.resolve(1, latestIsGit, false)
    expect(Boolean(button())).toBe(latestIsGit)
    const renders = host.useWorkspaces.mock.calls.length
    await host.resolve(0, !latestIsGit, false)
    expect(Boolean(button())).toBe(latestIsGit)
    expect(host.useWorkspaces).toHaveBeenCalledTimes(renders)
  })

  it("does not publish a late result after plugin disposal", async () => {
    const host = setup()
    render(host.element)
    act(() => host.dispose())
    expect(host.workspaceListeners.size).toBe(0)
    const renders = host.useWorkspaces.mock.calls.length
    await host.resolve(0, true, false)
    expect(button()).toBeNull()
    expect(host.useWorkspaces).toHaveBeenCalledTimes(renders)
    host.refresh()
    expect(host.call).toHaveBeenCalledTimes(1)
  })

  it("unsubscribes an unmounted dock and gives a new mount the completed snapshot", async () => {
    const host = setup()
    const view = render(host.element)
    view.unmount()
    const renders = host.useWorkspaces.mock.calls.length
    await host.resolve(0, true, false)
    expect(host.useWorkspaces).toHaveBeenCalledTimes(renders)
    render(host.element)
    expect(button()).not.toBeNull()
  })
})
