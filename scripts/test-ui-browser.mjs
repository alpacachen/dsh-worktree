/** Real client bundle + current Host theme, fixture services only; no real API writes.
 * Build first. PLAYWRIGHT_MODULE / CHROME_PATH select existing browser tooling.
 * DSH_TEST_URL defaults to the existing GUI; DSH_TEST_COOKIE is optional, env-only.
 */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.DSH_TEST_URL ?? 'http://127.0.0.1:3080'
const output = process.env.UI_SCREENSHOT_DIR ?? '/tmp/worktree-ui-review'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  if (process.env.DSH_TEST_COOKIE) {
    const [name, ...value] = process.env.DSH_TEST_COOKIE.split('=')
    await context.addCookies([{ name, value: value.join('='), url: base }])
  }
  await context.route('**/*', route => {
    const req = route.request()
    if (new URL(req.url()).pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method())) {
      return route.fulfill({ status: 503, body: 'Real APIs disabled in UI fixture.' })
    }
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    let loader
    Object.defineProperty(window, '__ModuleLoader__', {
      configurable: true, get: () => loader,
      set(value) {
        loader = value
        const create = value.create
        value.create = function (options) {
          window.testModules = create.call(this, options)
          window.testSeeds = options.staticModules
          throw new Error('WORKTREE_TEST_BOOT_STOP')
        }
      },
    })
  })
  const response = await page.goto(base)
  assert.ok(![401, 403].includes(response?.status()), 'GUI requires authentication; supply DSH_TEST_COOKIE, never bypass it')
  await page.waitForFunction(() => window.testModules)
  const themePath = await page.evaluate(() => window.testModules.manifest.modules.find(row => row.id === '@deepseek-ai/dsh-client-ui-theme').initialUrl)
  const themeUrl = new URL(themePath, base)
  assert.equal(themeUrl.origin, new URL(base).origin)
  assert.ok(!themeUrl.pathname.startsWith('/api/'))
  const theme = await page.request.get(themeUrl.href)
  assert.equal(theme.ok(), true)
  const sheets = [...(await theme.text()).matchAll(/var (\w+_css_default) = ("(?:[^"\\]|\\.)*");/g)].map(match => JSON.parse(match[2]))
  assert.ok(sheets.length >= 6, 'Load the actual installed Host theme, not fallback colours')
  await page.addStyleTag({ content: sheets.join('\n') })
  await page.evaluate(async () => {
    const id = '@alpacachen/dsh-simple-worktree'
    if (window.testModules.manifest.modules.some(row => row.id === id)) await window.testModules.prefetch(id)
    window.testModules.invalidate(id)
  })
  await page.addScriptTag({ path: fileURLToPath(new URL('../client/client.js', import.meta.url)) })
  const labels = await page.evaluate(async () => {
    const plugin = await window.testModules.import('@alpacachen/dsh-simple-worktree')
    const React = window.testSeeds.react
    const ReactDOM = window.testSeeds['react-dom/client']
    const components = {}
    const workspace = { workspaceId: 'fixture', path: '/projects/dori-workspace', title: 'dori-workspace', sessionIds: ['fixture-session'] }
    const snapshot = { items: [workspace] }
    const repository = { repoPath: workspace.path, defaultBranch: 'master', worktrees: [
      { path: workspace.path, branch: 'docs/testing-guide-20260928', isMain: true },
      { path: '/projects/dori-workspace.worktrees/fixture', branch: 'task/fixture', isMain: false },
    ] }
    let labels
    const locale = {
      register: (_namespace, dictionaries) => { labels = dictionaries.zh; return () => {} },
      bind: () => key => labels[key] ?? key,
    }
    plugin.apply({
      get: name => name === 'locale' ? locale : undefined,
      effect: effect => effect(),
      connection: { rpc: { call: async (_channel, method) => {
        const values = {
          'worktree.classify': { path: workspace.path, isGit: true, isWorktree: false },
          'worktree.list': repository, 'worktree.scan': [repository],
          'worktree.status': { changedFiles: 0 },
        }
        const key = method.split('/').pop()
        if (!(key in values)) throw new Error(`Unexpected fixture mutation: ${method}`)
        return { ok: true, value: values[key] }
      } } },
      workspaces: { list: { getSnapshot: () => snapshot, subscribe: () => () => {} } },
      sessions: {},
      slots: { inject: (_name, install) => install(), register: (meta, Component) => { components[meta.id] = Component } },
    })
    document.body.replaceChildren()
    document.body.style.margin = '0'
    document.body.style.background = 'var(--dsw-alias-bg-base)'
    const root = document.createElement('div')
    document.body.append(root)
    const h = React.createElement
    ReactDOM.createRoot(root).render(h(React.Fragment, null,
      h('div', { 'data-slot': 'conversation.composer' },
        h('div', null, h('button', { 'aria-haspopup': 'menu' }, 'Workspace'), h('div', { 'data-slot': 'conversation.hero.agentPreset' })),
        h(components['dsh-simple-worktree-new-session'], { session: { sessionId: 'fixture-session', blank: true }, useWorkspaces: select => select(snapshot) })),
      h(components['dsh-simple-worktree-create']),
      h(components['dsh-simple-worktree'], { close: () => {} }),
    ))
    return labels
  })
  const styles = (locator, names) => locator.evaluate((el, names) => Object.fromEntries(names.map(name => [name, getComputedStyle(el)[name]])), names)
  const token = name => page.evaluate(name => {
    const probe = document.createElement('span')
    probe.style.color = `var(${name})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, name)
  const dialog = page.locator('.dswt-dialog-content')
  const backgrounds = []
  for (const dark of [false, true]) {
    await page.evaluate(dark => {
      document.body.toggleAttribute('data-ds-dark-theme', dark)
      document.body.style.colorScheme = dark ? 'dark' : 'light'
    }, dark)
    const scheme = dark ? 'dark' : 'light'
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 820 })
      await page.locator('.dswt-new-session-button').click()
      await page.getByRole('textbox', { name: labels.taskName, exact: true }).waitFor()
      const css = await styles(dialog, ['backgroundColor', 'borderTopWidth', 'borderRadius', 'boxShadow', 'fontFamily'])
      assert.equal(css.backgroundColor, await token('--dsw-alias-bg-layer-2'))
      assert.match(css.backgroundColor, /^rgb\(/, 'Modal must be opaque, never the translucent menu surface')
      assert.equal(css.borderTopWidth, '0px')
      assert.equal(css.borderRadius, '28px')
      assert.notEqual(css.boxShadow, 'none')
      backgrounds.push(css.backgroundColor)
      const name = page.getByRole('textbox', { name: labels.taskName, exact: true })
      await name.fill('login-fix')
      await name.focus()
      assert.deepEqual(await styles(name, ['borderTopColor', 'outlineStyle', 'boxShadow']), {
        borderTopColor: await token('--dsw-alias-state-business-primary'), outlineStyle: 'none', boxShadow: 'none',
      })
      assert.equal(await page.getByRole('button', { name: labels.createAndOpen, exact: true }).isEnabled(), true)
      await page.keyboard.press('Tab')
      assert.equal(await page.getByRole('radio', { name: `${labels.mainBranch} master`, exact: true }).evaluate(el => el === document.activeElement), true)
      await page.keyboard.press('ArrowLeft')
      assert.equal(await page.getByRole('radio', { name: `${labels.currentBranch} docs/testing-guide-20260928`, exact: true }).isChecked(), true)
      const focused = page.locator('.dswt-radio-option:has(input:focus-visible)')
      assert.deepEqual(await styles(focused, ['outlineWidth', 'outlineOffset']), { outlineWidth: '2px', outlineOffset: '-2px' })
      for (const selector of ['.dswt-dialog-title', '.dswt-form-note', '.dswt-input', '.dswt-button', '.dswt-repo-context code', '.dswt-preview-value']) {
        assert.equal((await styles(dialog.locator(selector).first(), ['fontFamily'])).fontFamily, css.fontFamily)
      }
      const box = await dialog.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width)
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true, 'No horizontal overflow')
      await page.screenshot({ path: `${output}/${scheme}-${width}.png` })
      await name.fill('bad..name')
      assert.equal(await name.getAttribute('aria-invalid'), 'true')
      assert.equal((await styles(name, ['borderTopColor'])).borderTopColor, await token('--dsw-alias-state-error-primary'))
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'hidden' })
    }
    // Small windows must scroll to the actions rather than clip them.
    await page.setViewportSize({ width: 390, height: 400 })
    await page.locator('.dswt-new-session-button').click()
    await page.getByRole('textbox', { name: labels.taskName, exact: true }).fill('long-task-name-'.repeat(8))
    const cancel = dialog.getByRole('button', { name: labels.cancel, exact: true })
    await cancel.scrollIntoViewIfNeeded()
    const actionBox = await cancel.boundingBox()
    assert.ok(actionBox.y >= 0 && actionBox.y + actionBox.height <= 400, 'Actions remain reachable on short screens')
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true)
    await cancel.click()
    await page.setViewportSize({ width: 390, height: 820 })
    // Removal uses the same shared dialog surface; never confirm a mutation.
    await page.getByRole('button', { name: labels.remove, exact: true }).click()
    assert.equal((await styles(dialog, ['backgroundColor'])).backgroundColor, await token('--dsw-alias-bg-layer-2'))
    await page.getByRole('button', { name: labels.cancel, exact: true }).click()
  }
  assert.notEqual(backgrounds[0], backgrounds[2], 'Dark theme must actually change the surface')
  assert.deepEqual(errors.filter(message => !message.includes('WORKTREE_TEST_BOOT_STOP')), [])
  console.log(`Worktree bundle UI passed: light/dark, desktop/mobile, opaque shared dialogs, focus, fonts, validation and keyboard. Screenshots: ${output}`)
} finally {
  await browser.close()
}
