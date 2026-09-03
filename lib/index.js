import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { readdir } from 'node:fs/promises'

const CHANNEL = '/dsh-simple-worktree'
const SETTINGS_NS = settingsNamespace('dsh-simple-worktree')
const SETTINGS_SCHEMA = z.object({})

export const ok = (value) => ({ ok: true, value })
const PUBLIC_ERROR_CODES = new Set([
  'bad-request',
  'cancelled',
])

export const fail = (code, message, details = {}) => ({
  ok: false,
  error: { code: PUBLIC_ERROR_CODES.has(code) ? code : 'bad-request', message, details: { issues: [], ...details } },
})

export const cleanPath = (value) => {
  const text = String(value ?? '')
  return text.length > 1 ? text.replace(/[\\/]+$/, '') : text
}

export const samePath = (left, right) => cleanPath(left) === cleanPath(right)

export async function runGit(subprocess, cwd, args) {
  const handle = subprocess.spawn({
    argv: ['git', '-C', cwd, ...args],
    cwd,
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: 2 * 1024 * 1024 },
      stderr: { maxBytes: 512 * 1024 },
    },
    graceMs: 1000,
  })
  const outcome = await handle.done
  const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
  const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
  if (outcome.exitCode !== 0 || outcome.signal !== null) {
    throw new Error(`git ${args.join(' ')} failed${outcome.signal ? ` (${outcome.signal})` : ` (exit ${outcome.exitCode})`}: ${stderr.trim() || stdout.trim()}`)
  }
  return stdout.trim()
}

async function tryRunGit(subprocess, cwd, args) {
  try {
    return await runGit(subprocess, cwd, args)
  } catch {
    return ''
  }
}

export async function detectDefaultBranch(subprocess, repoPath, worktrees) {
  const [remoteHead, refsOutput] = await Promise.all([
    tryRunGit(subprocess, repoPath, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']),
    tryRunGit(subprocess, repoPath, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin']),
  ])
  const refs = new Set(refsOutput.split(/\r?\n/).filter(Boolean))

  if (remoteHead) {
    const separator = remoteHead.indexOf('/')
    const name = separator >= 0 ? remoteHead.slice(separator + 1) : ''
    if (name) return { name, ref: refs.has(name) ? name : remoteHead }
  }

  for (const name of ['main', 'master', 'trunk', 'develop']) {
    if (refs.has(name)) return { name, ref: name }
    if (refs.has(`origin/${name}`)) return { name, ref: `origin/${name}` }
  }
  const name = worktrees.find((worktree) => worktree.isMain)?.branch ?? worktrees.find((worktree) => worktree.branch)?.branch
  return name ? { name, ref: name } : { name: 'HEAD', ref: 'HEAD' }
}

const IGNORED_SCAN_DIRECTORIES = new Set(['.git', '.dsh', 'node_modules'])

export async function discoverGitRoots(rootPath) {
  const roots = []
  const visit = async (directory) => {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch { return }
    if (entries.some((entry) => entry.name === '.git')) {
      roots.push(directory)
      return
    }
    await Promise.all(entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && !IGNORED_SCAN_DIRECTORIES.has(entry.name))
      .map((entry) => visit(`${directory}/${entry.name}`)))
  }
  await visit(cleanPath(rootPath))
  return roots
}

export function parseWorktrees(text) {
  const rows = []
  let current
  const push = () => {
    if (current?.path) rows.push(current)
    current = undefined
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      push()
      current = { path: line.slice(9).trim() }
    } else if (current && line.startsWith('HEAD ')) {
      current.head = line.slice(5).trim()
    } else if (current && line.startsWith('branch ')) {
      const ref = line.slice(7).trim()
      current.branch = ref.startsWith('refs/heads/') ? ref.slice(11) : ref
    } else if (current && line === 'detached') {
      current.detached = true
    } else if (current && line.startsWith('locked')) {
      current.locked = true
    } else if (current && line.startsWith('prunable')) {
      current.prunable = true
    }
  }
  push()
  return rows.map((row, index) => ({
    path: row.path,
    branch: row.branch,
    head: row.head,
    isMain: index === 0,
    detached: row.detached === true,
    locked: row.locked === true,
    prunable: row.prunable === true,
  }))
}

export async function recover(operation, classify) {
  try {
    return ok(await operation())
  } catch (error) {
    const message = String(error?.message ?? error)
    return fail(classify?.(message) ?? 'bad-request', message)
  }
}

export const classifyGitError = (message) => message.includes('not a git repository')
  ? 'not-git-repository'
  : message.includes('is not a working tree') || message.includes('No such file or directory')
    ? 'worktree-unavailable'
    : undefined

export const name = '@alpacachen/dsh-simple-worktree'
export const inject = ['connection', 'subprocess', 'settings']

export function apply(ctx) {
  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (settingsCtx) => {
      installSettingsSection(settingsCtx, SETTINGS_NS, SETTINGS_SCHEMA, {}, {
        setSource: () => {},
        onChange: () => {},
      })
    })
  }
  ctx.effect(() => ctx.connection.rpc.handle(CHANNEL, async (endpoint, payload = {}, signal) => {
    if (signal?.aborted) return fail('cancelled', 'The request was cancelled.')

    const listRepository = async (path) => {
      if (!path) throw new Error('请选择一个 DSH Workspace。')
      const [topLevel, commonDir, porcelain] = await Promise.all([
        runGit(ctx.subprocess, path, ['rev-parse', '--show-toplevel']),
        runGit(ctx.subprocess, path, ['rev-parse', '--git-common-dir']),
        runGit(ctx.subprocess, path, ['worktree', 'list', '--porcelain']),
      ])
      const worktrees = parseWorktrees(porcelain)
      const repoPath = worktrees.find((worktree) => worktree.isMain)?.path ?? topLevel
      const defaultBranch = await detectDefaultBranch(ctx.subprocess, repoPath, worktrees)
      return { repoPath, commonDir, defaultBranch: defaultBranch.name, defaultRef: defaultBranch.ref, worktrees }
    }

    if (endpoint === 'worktree.list') return recover(async () => {
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      return listRepository(path)
    }, classifyGitError)

    if (endpoint === 'worktree.scan') return recover(async () => {
      const paths = Array.isArray(payload.paths)
        ? payload.paths.filter((path) => typeof path === 'string').map((path) => path.trim()).filter(Boolean)
        : []
      const roots = (await Promise.all(paths.map((path) => discoverGitRoots(path)))).flat()
      const seen = new Set()
      const repositories = []
      for (const root of roots) {
        try {
          const repository = await listRepository(root)
          const key = cleanPath(repository.repoPath)
          if (key && !seen.has(key)) {
            seen.add(key)
            repositories.push(repository)
          }
        } catch {
          // A repository can disappear while a scan is in progress.
        }
      }
      return repositories
    })

    if (endpoint === 'worktree.classify') return recover(async () => {
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (!path) throw new Error('缺少 Workspace 路径。')
      const porcelain = await runGit(ctx.subprocess, path, ['worktree', 'list', '--porcelain'])
      const worktrees = parseWorktrees(porcelain)
      const current = worktrees.find((worktree) => samePath(worktree.path, path))
      return {
        path,
        isGit: worktrees.length > 0,
        isWorktree: Boolean(current && !current.isMain),
        repoPath: worktrees.find((worktree) => worktree.isMain)?.path,
      }
    }, classifyGitError)

    if (endpoint === 'worktree.create') return recover(async () => {
      const repoPath = typeof payload.repoPath === 'string' ? payload.repoPath.trim() : ''
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      const branch = typeof payload.branch === 'string' ? payload.branch.trim() : ''
      const baseRef = typeof payload.baseRef === 'string' && payload.baseRef.trim() ? payload.baseRef.trim() : 'HEAD'
      if (!repoPath || !path || !branch) throw new Error('任务名称、工作目录和分支不能为空。')
      await runGit(ctx.subprocess, repoPath, ['worktree', 'add', '-b', branch, path, baseRef])
      return { path, branch, baseRef }
    })

    if (endpoint === 'worktree.remove') return recover(async () => {
      const repoPath = typeof payload.repoPath === 'string' ? payload.repoPath.trim() : ''
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (!repoPath || !path) throw new Error('缺少仓库路径或 Worktree 路径。')
      await runGit(ctx.subprocess, repoPath, ['worktree', 'remove', path])
      return { removed: true, path }
    })

    if (endpoint === 'worktree.remove-session') return recover(async () => {
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (!path) throw new Error('缺少 Session 工作目录。')
      const porcelain = await runGit(ctx.subprocess, path, ['worktree', 'list', '--porcelain'])
      const worktrees = parseWorktrees(porcelain)
      const target = worktrees.find((worktree) => samePath(worktree.path, path))
      if (!target || target.isMain) return { removed: false, path }
      const repoPath = worktrees.find((worktree) => worktree.isMain)?.path
      if (!repoPath) throw new Error('无法定位主仓库。')
      await runGit(ctx.subprocess, repoPath, ['worktree', 'remove', target.path])
      return { removed: true, path: target.path }
    }, classifyGitError)

    if (endpoint === 'worktree.status') return recover(async () => {
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (!path) throw new Error('缺少 Worktree 路径。')
      const output = await runGit(ctx.subprocess, path, ['status', '--short', '--branch'])
      const lines = output ? output.split(/\r?\n/) : []
      return {
        branchLine: lines.find((line) => line.startsWith('## ')) ?? '',
        changedFiles: lines.filter((line) => line && !line.startsWith('## ')).length,
        output,
      }
    })

    if (endpoint === 'worktree.prune') return recover(async () => {
      const path = typeof payload.path === 'string' ? payload.path.trim() : ''
      if (!path) throw new Error('缺少仓库路径。')
      await runGit(ctx.subprocess, path, ['worktree', 'prune'])
      return { pruned: true }
    })

    return fail('bad-request', `Unknown endpoint: ${endpoint}`)
  }, { authority: 'loopback' }), 'dsh-simple-worktree rpc')
}
