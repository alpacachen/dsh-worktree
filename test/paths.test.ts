import { describe, expect, it } from "vitest"
import { cleanPath, slugOf, suggestedPath } from "../src/client/lib/paths"

describe("worktree path helpers", () => {
  it("normalizes trailing separators without changing root paths", () => {
    expect(cleanPath("/repo///")).toBe("/repo")
    expect(cleanPath("C:\\repo\\\\")).toBe("C:\\repo")
    expect(cleanPath("/")).toBe("/")
  })

  it("creates safe stable slugs", () => {
    expect(slugOf(" Login fix ")).toBe("login-fix")
    expect(slugOf("中文任务")).toBe("task")
    expect(slugOf("")).toBe("task")
  })

  it("suggests a sibling worktree directory for POSIX and Windows paths", () => {
    expect(suggestedPath("/repo", "login-fix")).toBe("/repo.worktrees/login-fix")
    expect(suggestedPath("C:\\repo", "login-fix")).toBe("C:\\repo.worktrees\\login-fix")
  })
})
