import { describe, expect, it } from "vitest"
import { cleanPath, pathKey, slugOf, suggestedPath } from "../src/client/lib/paths"

describe("worktree path helpers", () => {
  it("matches Windows workspace paths with Git porcelain paths", () => {
    expect(pathKey("C:\\repo\\task\\")).toBe(pathKey("c:/repo/task"))
    expect(pathKey("\\\\server\\repo")).toBe(pathKey("//server/repo"))
    expect(pathKey("/repo/a\\b")).not.toBe(pathKey("/repo/a/b"))
  })
  it("normalizes trailing separators without changing root paths", () => {
    expect(cleanPath("/repo///")).toBe("/repo")
    expect(cleanPath("C:\\repo\\\\")).toBe("C:\\repo")
    expect(cleanPath("/")).toBe("/")
  })

  it("creates safe stable slugs", () => {
    expect(slugOf(" Login fix ")).toBe("login-fix")
    expect(slugOf("タスク")).toBe("task")
    expect(slugOf("")).toBe("task")
  })

  it("suggests a sibling worktree directory for POSIX and Windows paths", () => {
    expect(suggestedPath("/repo", "login-fix")).toBe("/repo.worktrees/login-fix")
    expect(suggestedPath("C:\\repo", "login-fix")).toBe("C:\\repo.worktrees\\login-fix")
  })
})
