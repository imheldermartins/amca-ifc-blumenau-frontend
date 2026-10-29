// Install outside the app lockfile: npm install --prefix dist/board-debug/runtime playwright
// node scripts/debug-board-browser.cjs [--url=http://127.0.0.1:5175] [--cards=20,1000]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const output = path.resolve(root, arg('output') || 'dist/board-debug/browser');
const counts = (arg('cards') || '20,1000').split(',').map(Number);
const FIRST = '01KXVZ00000000000000000002', SECOND = '01KXVZ00000000000000000003';
const report = { startedAt: new Date().toISOString(), cases: [], errors: [] };
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
let browser, server, context;
const playwright = (() => {
  if (process.env.BOARD_PLAYWRIGHT_MODULE) return require(process.env.BOARD_PLAYWRIGHT_MODULE);
  try { return require('playwright'); } catch { return require(path.join(root, 'dist/board-debug/runtime/node_modules/playwright')); }
})();
async function state(page) {
  return page.evaluate(() => ({
    time: performance.now(), moves: Number(document.querySelector('[data-moves]').dataset.moves),
    log: JSON.parse(document.querySelector('[data-move-log]').textContent),
    placeholders: [...document.querySelectorAll('[data-drag-placeholder]')].map(node => {
      const wrapper = node.parentElement.parentElement;
      const rect = wrapper.getBoundingClientRect();
      return { column: node.closest('[data-board-column]')?.dataset.boardColumn, index: [...wrapper.parentElement.children].indexOf(wrapper), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    }),
    lanes: [...document.querySelectorAll('[data-board-column]')].map(node => ({ column: node.dataset.boardColumn, first: [...node.querySelectorAll('[data-board-card]')].slice(0, 12).map(card => card.dataset.boardCard) })),
  }));
}
async function snap(page, entry, label) {
  const value = { label, ...await state(page) };
  entry.snapshots.push(value);
  fs.writeFileSync(path.join(output, `${entry.name}.json`), JSON.stringify(entry, null, 2));
  return value;
}
async function shot(page, name) {
  // Keep active animations running; disabling them could change the drag being investigated.
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
async function open(count, name) {
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push({ name, error: error.message }));
  await page.addInitScript(() => {
    window.__boardPointerEvents = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, event => {
      window.__boardPointerEvents.push({ type, x: event.clientX, y: event.clientY, buttons: event.buttons, pressure: event.pressure, pointerType: event.pointerType, time: performance.now() });
    }, true);
  });
  await page.goto(`${report.baseUrl}/board-dnd-preview.html?cards=${count}`);
  await page.locator('[data-board-card]').nth(count - 1).waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  await frames(page);
  return page;
}
async function run(name, count, action) {
  const page = await open(count, name);
  const entry = { name, count, snapshots: [], started: Date.now() };
  try {
    await action(page, entry);
    entry.passed = true;
  } catch (error) {
    entry.passed = false; entry.error = error.stack;
    await shot(page, `${name}-failure`);
  } finally {
    entry.elapsedMs = Date.now() - entry.started;
    entry.pointerEvents = await page.evaluate(() => window.__boardPointerEvents);
    fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(entry, null, 2));
    report.cases.push(entry);
    console.log(`${entry.passed ? 'PASS' : 'FAIL'} ${name} (${entry.elapsedMs}ms)${entry.error ? '\n' + entry.error : ''}`);
    await page.close();
  }
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  if (arg('url')) report.baseUrl = arg('url');
  else {
    const [{ createServer }, { default: react }, { default: tailwind }] = await Promise.all([import('vite'), import('@vitejs/plugin-react'), import('@tailwindcss/vite')]);
    server = await createServer({ configFile: false, root, cacheDir: path.join(root, 'dist/board-debug/vite-cache'), optimizeDeps: { entries: ['board-dnd-preview.html'] }, plugins: [react(), tailwind()], resolve: { alias: { '@': path.join(root, 'src'), '@components': path.join(root, 'src/components'), '@contexts': path.join(root, 'src/contexts'), '@locales': path.join(root, 'src/locales'), 'cubs-components': path.join(root, 'src/shared/cubs-components'), 'cubs-database': path.join(root, 'src/shared/cubs-database') } }, server: { host: '127.0.0.1', port: 5176, strictPort: true } });
    await server.listen(); report.baseUrl = 'http://127.0.0.1:5176';
  }
  browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  for (const count of counts) {
    await run(`keyboard-${count}`, count, async (page, entry) => {
      await snap(page, entry, 'initial');
      await page.getByRole('button', { name: 'Arrastar Página 0', exact: true }).press('Space');
      await page.waitForFunction(() => !!document.querySelector('[data-drag-placeholder]'));
      assert.equal((await snap(page, entry, 'activated')).placeholders[0].column, FIRST);
      await frames(page);
      for (let index = 1; index <= 8; index++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(expected => {
          const node = document.querySelector('[data-drag-placeholder]');
          const wrapper = node?.parentElement.parentElement;
          return wrapper && [...wrapper.parentElement.children].indexOf(wrapper) === expected;
        }, index, { timeout: 5000 });
        assert.equal((await snap(page, entry, `ArrowDown-${index}`)).placeholders[0].column, FIRST);
      }
      await shot(page, `keyboard-${count}-moved`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-drag-placeholder]'));
      const cancelled = await snap(page, entry, 'cancelled');
      assert.equal(cancelled.moves, 0); assert.equal(cancelled.lanes[0].first[0], 'row-0');
    });
    for (const speed of ['fast', 'slow']) await run(`pointer-${speed}-${count}`, count, async (page, entry) => {
      const handle = await page.getByRole('button', { name: 'Arrastar Página 0', exact: true }).boundingBox();
      const target = await page.locator('[data-board-card="row-3"]').boundingBox();
      const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 3, y); await frames(page);
      assert.equal((await snap(page, entry, 'held-below-4px')).placeholders.length, 0);
      await page.mouse.move(x + 6, y);
      await page.waitForFunction(() => !!document.querySelector('[data-drag-placeholder]'));
      await snap(page, entry, 'activated-above-4px');
      if (speed === 'slow') await page.waitForTimeout(200);
      await page.mouse.move(x + 6, target.y + 1, { steps: speed === 'slow' ? 16 : 1 });
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-drag-placeholder]');
        const wrapper = node?.parentElement.parentElement;
        return wrapper && [...wrapper.parentElement.children].indexOf(wrapper) > 0;
      });
      const moved = await snap(page, entry, 'moved-held');
      assert.equal(moved.placeholders[0].column, FIRST); assert.equal(moved.moves, 0);
      await shot(page, `${entry.name}-held`);
      await page.keyboard.press('Escape'); await page.mouse.up();
      await page.waitForFunction(() => !document.querySelector('[data-drag-placeholder]'));
      const cancelled = await snap(page, entry, 'cancelled');
      assert.equal(cancelled.moves, 0); assert.equal(cancelled.lanes[0].first[0], 'row-0');
    });
    await run(`pointer-drop-${count}`, count, async (page, entry) => {
      const handle = await page.getByRole('button', { name: 'Arrastar Página 0', exact: true }).boundingBox();
      const target = await page.locator(`[data-board-column="${SECOND}"] [data-board-card]`).first().boundingBox();
      await page.mouse.move(handle.x + 12, handle.y + 12); await page.mouse.down();
      await page.mouse.move(handle.x + 18, handle.y + 12);
      await page.waitForFunction(() => !!document.querySelector('[data-drag-placeholder]'));
      await page.mouse.move(target.x + 20, target.y + 1, { steps: 8 });
      await page.waitForFunction(key => document.querySelector('[data-drag-placeholder]')?.closest('[data-board-column]')?.getAttribute('data-board-column') === key, SECOND);
      await snap(page, entry, 'destination'); await shot(page, `${entry.name}-destination`);
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('[data-moves]')?.getAttribute('data-moves') === '1');
      const dropped = await snap(page, entry, 'released');
      assert.equal(dropped.moves, 1); assert.equal(dropped.log[0].rowId, 'row-0');
      assert.equal(dropped.log[0].optionId, SECOND);
    });
  }
})().catch(error => { report.errors.push(error.stack); console.error(error); process.exitCode = 1; }).finally(async () => {
  if (context) await context.tracing.stop({ path: path.join(output, 'trace.zip') });
  if (browser) await browser.close();
  if (server) await server.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (report.errors.length || report.cases.some(entry => !entry.passed)) process.exitCode = 1;
  console.log(`Evidence: ${output}`);
});
