export function cleanPath(value: unknown) {
  const text = String(value ?? "")
  return text.length > 1 ? text.replace(/[\\/]+$/, "") : text
}

export function slugOf(value: unknown) {
  return String(value || "task").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "task"
}

export function suggestedPath(repoPath: string, slug: string) {
  const separator = repoPath.includes("\\") ? "\\" : "/"
  return `${cleanPath(repoPath)}.worktrees${separator}${slug}`
}
