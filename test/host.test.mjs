import { describe, expect, it } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { apply, discoverGitRoots, fail, parseWorktrees } from "../src/host/index.js"

function handleFor(outputs = {}) {
  const routes = new Map()
  const subprocess = {
    spawn({ argv }) {
      const key = argv.slice(3).join(" ")
      const result = outputs[key] ?? ""
      const stdout = typeof result === "string" ? result : result.stdout ?? ""
      const stderr = typeof result === "string" ? "" : result.stderr ?? ""
      const exitCode = typeof result === "string" ? 0 : result.exitCode ?? 0
      return {
        done: Promise.resolve({ exitCode, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: stdout }) },
          stderr: { readFrom: () => ({ text: stderr }) },
        },
      }
    },
  }
  const ctx = {
    subprocess,
    connection: { fetch: { register(route) {
      expect(routes.has(route.path)).toBe(false)
      routes.set(route.path, route)
      return () => routes.delete(route.path)
    } } },
    effect(effect) { return effect() },
  }
  apply(ctx)
  const handler = async (endpoint, payload = {}, signal, method = `dsh-simple-worktree/${endpoint}`) => {
    const path = `/api/dsh-simple-worktree/${endpoint}`
    const route = routes.get(path)
    expect(route, `missing exact route: ${path}`).toBeDefined()
    expect(route.methods).toEqual(["POST"])
    expect(route.requestBody).toBe("buffered")
    const controller = new AbortController()
    if (signal?.aborted) controller.abort()
    const request = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "client-request", rpcId: "test", method, payload }),
      signal: controller.signal,
    })
    const response = await route.fetch(request)
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)
    const message = await response.json()
    expect(message).toEqual({ type: "server-response", rpcId: "test", result: expect.any(Object) })
    return message.result
  }
  return Object.assign(handler, { routes })
}

describe("worktree porcelain parser", () => {
  it("discovers nested Git roots while skipping noisy directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-worktree-"))
    try {
      await mkdir(join(root, "projects", "one", ".git"), { recursive: true })
      await mkdir(join(root, "node_modules", "ignored", ".git"), { recursive: true })
      await mkdir(join(root, "projects", "two"), { recursive: true })
      await writeFile(join(root, "projects", "two", ".git"), "gitdir: ../one/.git\n")
      expect((await discoverGitRoots(root)).sort()).toEqual([
        join(root, "projects", "one"),
        join(root, "projects", "two"),
      ].sort())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("inspects depth four by default but does not descend to depth five", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-worktree-depth-"))
    const depthFour = join(root, "a", "b", "c", "four")
    const depthFive = join(root, "a", "b", "c", "d", "five")
    try {
      await mkdir(join(depthFour, ".git"), { recursive: true })
      await mkdir(join(depthFive, ".git"), { recursive: true })
      expect(await discoverGitRoots(root)).toEqual([depthFour])
      expect((await discoverGitRoots(root, { maxDepth: 5 })).sort()).toEqual([depthFour, depthFive].sort())
      expect(await discoverGitRoots(root, { maxDepth: 3 })).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("skips hidden and noisy descendants but permits .worktrees and explicit hidden roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-worktree-hidden-"))
    const ignored = [".cache", ".config", ".hidden", "node_modules", "Library", "dist", "build", "vendor"]
    try {
      for (const directory of [...ignored, ".worktrees", "projects"]) {
        await mkdir(join(root, directory, "repo", ".git"), { recursive: true })
      }
      expect((await discoverGitRoots(root)).sort()).toEqual([
        join(root, ".worktrees", "repo"), join(root, "projects", "repo"),
      ].sort())
      expect(await discoverGitRoots(join(root, ".hidden"))).toEqual([join(root, ".hidden", "repo")])
      expect(await discoverGitRoots(join(root, ".hidden", "repo"), { maxDepth: 0 })).toEqual([join(root, ".hidden", "repo")])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("throws instead of returning a partial scan when the directory budget is exceeded", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-worktree-budget-"))
    try {
      await mkdir(join(root, "repo", ".git"), { recursive: true })
      await expect(discoverGitRoots(root, { maxDirectories: 1 })).rejects.toThrow(/scan limit reached.*more specific Workspace/)
      expect(await discoverGitRoots(root, { maxDirectories: 2 })).toEqual([join(root, "repo")])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("rejects an already cancelled scan with the AbortSignal reason", async () => {
    const controller = new AbortController()
    const reason = new Error("scan cancelled by caller")
    controller.abort(reason)
    await expect(discoverGitRoots(tmpdir(), { signal: controller.signal })).rejects.toBe(reason)
  })

  it("honors cancellation while a directory read is in flight", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-worktree-abort-"))
    try {
      await mkdir(join(root, "nested", "repo", ".git"), { recursive: true })
      const controller = new AbortController()
      const reason = new Error("scope changed")
      const scan = discoverGitRoots(root, { signal: controller.signal })
      controller.abort(reason)
      await expect(scan).rejects.toBe(reason)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("parses main, branches and worktree state flags", () => {
    const rows = parseWorktrees([
      "worktree /repo",
      "HEAD abc",
      "branch refs/heads/main",
      "",
      "worktree /repo.worktrees/feature",
      "HEAD def",
      "branch refs/heads/feature",
      "locked reason",
      "",
      "worktree /repo.worktrees/detached",
      "HEAD ghi",
      "detached",
    ].join("\n"))
    expect(rows).toEqual([
      expect.objectContaining({ path: "/repo", branch: "main", isMain: true }),
      expect.objectContaining({ path: "/repo.worktrees/feature", branch: "feature", locked: true, isMain: false }),
      expect.objectContaining({ path: "/repo.worktrees/detached", detached: true, isMain: false }),
    ])
  })
})

describe("worktree RPC contract", () => {
  it("registers only exact shared API routes for every endpoint", () => {
    expect([...handleFor().routes.keys()].sort()).toEqual([
      "worktree.list", "worktree.scan", "worktree.classify", "worktree.create",
      "worktree.remove", "worktree.remove-session", "worktree.status", "worktree.prune",
    ].map((endpoint) => `/api/dsh-simple-worktree/${endpoint}`).sort())
  })

  const porcelain = [
    "worktree /repo",
    "HEAD abc",
    "branch refs/heads/main",
    "",
    "worktree /repo.worktrees/feature",
    "HEAD def",
    "branch refs/heads/feature",
  ].join("\n")

  it("classifies a linked worktree and lists its repository", async () => {
    const handler = handleFor({
      "worktree list --porcelain": porcelain,
      "rev-parse --show-toplevel": "/repo",
      "rev-parse --git-common-dir": ".git",
      "symbolic-ref --quiet --short refs/remotes/origin/HEAD": "origin/main",
    })
    expect(await handler("worktree.classify", { path: "/repo.worktrees/feature" })).toEqual({
      ok: true,
      value: { path: "/repo.worktrees/feature", isGit: true, isWorktree: true, repoPath: "/repo" },
    })
    expect((await handler("worktree.list", { path: "/repo.worktrees/feature" })).value).toMatchObject({ repoPath: "/repo", defaultBranch: "main", defaultRef: "origin/main" })
  })

  it("reuses an existing branch when creating a worktree", async () => {
    const handler = handleFor({
      "show-ref --verify --quiet refs/heads/task/123": "abc refs/heads/task/123",
      "worktree add /repo.worktrees/123 task/123": "Preparing worktree",
    })
    expect(await handler("worktree.create", { repoPath: "/repo", path: "/repo.worktrees/123", branch: "task/123", baseRef: "master" })).toEqual({
      ok: true,
      value: { path: "/repo.worktrees/123", branch: "task/123", baseRef: "master" },
    })
  })
  it("prefers a local default branch when both local and remote refs exist", async () => {
    const handler = handleFor({
      "worktree list --porcelain": porcelain,
      "rev-parse --show-toplevel": "/repo",
      "rev-parse --git-common-dir": ".git",
      "symbolic-ref --quiet --short refs/remotes/origin/HEAD": "origin/main",
      "for-each-ref --format=%(refname:short) refs/heads refs/remotes/origin": "main\norigin/main",
    })

    expect((await handler("worktree.list", { path: "/repo" })).value).toMatchObject({ defaultBranch: "main", defaultRef: "main" })
  })

  it("normalizes plugin-specific errors to the DSH public error contract", () => {
    expect(fail("not-git-repository", "fatal: not a git repository")).toMatchObject({
      ok: false,
      error: { code: "bad-request", message: "fatal: not a git repository" },
    })
  })
  it("returns the stable error envelope for bad requests and cancellation", async () => {
    const handler = handleFor()
    expect(await handler("worktree.list", {})).toMatchObject({ ok: false, error: { code: "bad-request", details: { issues: [] } } })
    expect(await handler("worktree.list", {}, undefined, "dsh-simple-worktree/worktree.unknown")).toMatchObject({
      ok: false, error: { code: "bad-request", message: "RPC method does not match endpoint.", details: { issues: [] } },
    })
    expect(await handler("worktree.list", {}, { aborted: true })).toMatchObject({ ok: false, error: { code: "cancelled" } })
  })
})
