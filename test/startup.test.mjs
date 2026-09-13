import { describe, expect, it, vi } from "vitest"
import { Context } from "@deepseek-ai/cordis"
import { SettingsProvider } from "@deepseek-ai/dsh-settings"
import { HostConnectionService, serverResponseSchema } from "@deepseek-ai/dsh-client-connection"
import * as source from "../src/host/index.js"
import * as publishedEntry from "../lib/index.js"

// Real Connection is important: a plain rpc.handle mock misses the rc.2
// service-shadow access to webServer that crashes the whole DSH on startup.
class MemorySettings extends SettingsProvider {
  async load() { return {} }
  async persist() {}
}

const endpoints = ["worktree.list", "worktree.scan", "worktree.classify", "worktree.create", "worktree.remove", "worktree.remove-session", "worktree.status", "worktree.prune"]
const requestFor = (endpoint, overrides = {}) => new Request(`http://localhost/api/dsh-simple-worktree/${endpoint}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "client-request", rpcId: "startup-test", method: `dsh-simple-worktree/${endpoint}`, payload: {}, ...overrides }),
})

describe.each([
  ["source", source],
  ["package entry", publishedEntry],
])("worktree startup (%s)", (_label, plugin) => {
  it("mounts authenticated-carrier routes, cleans up, and remounts", async () => {
    const root = new Context()
    const register = vi.fn(() => () => {})
    const spawn = vi.fn(() => { throw new Error("startup must not run git") })
    try {
      // Sibling providers match a real profile. Providing webServer on root
      // grants descendants access and accidentally hides the original bug.
      await root.plugin({
        apply(ctx) {
          ctx.provide("webServer", { register })
          ctx.provide("subprocess", { spawn })
        },
      })
      await root.plugin(MemorySettings)
      await root.plugin({
        apply(ctx) {
          new HostConnectionService(ctx, [], { isAuthenticated: () => true })
        },
      })
      const carrier = root.get("connection").createSharedFetchHandler("/api")
      const namespaces = () => root.get("settings").describe().map(({ ns }) => ns)

      for (let attempt = 0; attempt < 2; attempt++) {
        const fiber = root.plugin(plugin)
        await fiber
        expect(namespaces()).toEqual(["dsh-simple-worktree"])
        for (const endpoint of endpoints) {
          const response = await carrier.fetch(requestFor(endpoint))
          expect(response.status).toBe(200)
          const envelope = serverResponseSchema.parse(await response.json())
          expect(envelope.type).toBe("server-response")
          expect(envelope.rpcId).toBe("startup-test")
        }
        const mismatched = await carrier.fetch(requestFor("worktree.prune", { method: "worktree.remove" }))
        expect((await mismatched.json()).result).toMatchObject({ ok: false, error: { code: "bad-request" } })
        const invalid = await carrier.fetch(requestFor("worktree.prune", { type: "invalid" }))
        expect(invalid.status).toBe(400)
        const nonJson = await carrier.fetch(new Request("http://localhost/api/dsh-simple-worktree/worktree.prune", { method: "POST", body: "not JSON" }))
        expect(nonJson.status).toBe(415)
        await fiber.dispose()
        expect(namespaces()).toEqual([])
        for (const endpoint of endpoints) {
          expect((await carrier.fetch(requestFor(endpoint))).status).toBe(404)
        }
      }
      // Routes stay under Connection's shared /api authentication fence; the
      // plugin must not register its own unauthenticated HTTP listener.
      expect(register).not.toHaveBeenCalled()
      expect(spawn).not.toHaveBeenCalled()
    } finally {
      await root.fiber.dispose()
    }
  })
})
