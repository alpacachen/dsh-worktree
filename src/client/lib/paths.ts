export function cleanPath(value: unknown) {
  const text = String(value ?? "")
  return text.length > 1 ? text.replace(/[\\/]+$/, "") : text
}

// Git emits slash-separated Windows paths, while workspace paths use backslashes.
export function pathKey(value: unknown) {
  const text = cleanPath(value)
  return /^[a-z]:[\\/]/i.test(text) || text.startsWith("\\\\")
    ? text.replace(/\\/g, "/").replace(/^[A-Z]:/, drive => drive.toLowerCase())
    : text
}

export function slugOf(value: unknown) {
  return String(value || "task").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "task"
}

export function suggestedPath(repoPath: string, slug: string) {
  const separator = repoPath.includes("\\") ? "\\" : "/"
  return `${cleanPath(repoPath)}.worktrees${separator}${slug}`
}
