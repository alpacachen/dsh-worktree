import { describe, expect, it, vi } from "vitest"
import { WorktreePlugin } from "../src/client/plugin"

describe("WorktreePlugin compatibility", () => {
  it("loads when the legacy workspace client has no workspaceExtensions service", () => {
    const registeredSlots: string[] = []
    const workspaces = {
      list: {
        getSnapshot: () => ({ items: [] }),
        subscribe: () => () => {},
      },
    }
    const ctx = {
      connection: { rpc: { call: vi.fn() } },
      workspaces,
      sessions: {},
      get: () => undefined,
      effect: (effect: () => unknown) => effect(),
      slots: {
        inject: (name: string) => registeredSlots.push(name),
      },
    }

    expect(() => WorktreePlugin.apply(ctx)).not.toThrow()
    expect(registeredSlots).toEqual(["conversation.input.dock", "shell.overlay", "settings.section"])
    expect(WorktreePlugin.inject).not.toContain("workspaceExtensions")
  })
})
