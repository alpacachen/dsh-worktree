import { describe, expect, it } from "vitest"
import { apply, fail, parseWorktrees } from "../src/host/index.js"

function handleFor(outputs = {}) {
  let handler
  const subprocess = {
    spawn({ argv }) {
      const key = argv.slice(3).join(" ")
      const stdout = outputs[key] ?? ""
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: stdout }) },
          stderr: { readFrom: () => ({ text: "" }) },
        },
      }
    },
  }
  const ctx = {
    subprocess,
    connection: { rpc: { handle: (_channel, next) => { handler = next } } },
    effect(effect) { return effect() },
  }
  apply(ctx)
  return handler
}

describe("worktree porcelain parser", () => {
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
    expect(await handler("worktree.unknown", {})).toMatchObject({ ok: false, error: { code: "bad-request", details: { issues: [] } } })
    expect(await handler("worktree.list", {}, { aborted: true })).toMatchObject({ ok: false, error: { code: "cancelled" } })
  })
})
