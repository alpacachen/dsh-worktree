import { describe, expect, it, vi } from "vitest"
import { WorktreePlugin } from "../src/client/plugin"

describe("WorktreePlugin compatibility", () => {
  it("loads against the DSH 0.1.5 client contract", () => {
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
      effect: (effect: () => unknown) => effect(),
      slots: {
        inject: (name: string) => registeredSlots.push(name),
      },
    }

    expect(() => WorktreePlugin.apply(ctx as any)).not.toThrow()
    expect(registeredSlots).toEqual(["conversation.input.dock", "shell.overlay", "settings.section"])
    expect(WorktreePlugin.inject).toEqual(["slots", "connection", "locale", "workspaces", "sessions"])
  })
})
