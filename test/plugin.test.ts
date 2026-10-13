import { describe, expect, it, vi } from "vitest"
import { WorktreePlugin } from "../src/client/plugin"

describe("WorktreePlugin compatibility", () => {
  it("loads with separate session data and workspace navigation services", async () => {
    const registeredSlots: string[] = []
    const renderers = new Map<string, (props: any) => any>()
    const workspaces = {
      list: {
        getSnapshot: () => ({ items: [] }),
        subscribe: () => () => {},
      },
    }
    const ctx = {
      connection: { rpc: { call: vi.fn() } },
      workspaces,
      sessions: { create: vi.fn() },
      uiWorkspace: { openSession: vi.fn() },
      effect: (effect: () => unknown) => effect(),
      slots: {
        inject: (name: string, register: () => void) => { registeredSlots.push(name); register() },
        register: (slot: { name: string }, render: (props: any) => any) => renderers.set(slot.name, render),
      },
    }

    expect(() => WorktreePlugin.apply(ctx as any)).not.toThrow()
    expect(registeredSlots).toEqual(["conversation.input.dock", "shell.overlay", "settings.section"])
    expect(WorktreePlugin.inject).toEqual(["slots", "connection", "locale", "workspaces", "sessions", "uiWorkspace"])
    // Exercise the actual adapter passed to consumers: ISessions has no open().
    const { sessions } = renderers.get("settings.section")!({ close: vi.fn() }).props
    await sessions.create({ workspaceId: "ws-new" })
    sessions.open("session-new")
    expect(ctx.sessions.create).toHaveBeenCalledWith({ workspaceId: "ws-new" })
    expect(ctx.sessions.create.mock.contexts[0]).toBe(ctx.sessions)
    expect(ctx.uiWorkspace.openSession).toHaveBeenCalledWith("session-new")
    expect(ctx.uiWorkspace.openSession.mock.contexts[0]).toBe(ctx.uiWorkspace)
  })
})
