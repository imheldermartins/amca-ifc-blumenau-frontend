// Reproduce the existing test with diagnostics; never modify its source or BoardView.
// node scripts/debug-board-jsdom.cjs [--stable-rects] [--separate-lanes] [--lane-boxes] [--cards=20]
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stable = process.argv.includes('--stable-rects');
const separate = process.argv.includes('--separate-lanes');
const boxes = process.argv.includes('--lane-boxes');
const count = Number(process.argv.find(arg => arg.startsWith('--cards='))?.slice(8) || 1000);
if (!Number.isInteger(count) || count < 20 || count > 1000 || count % 2) throw new Error('--cards must be an even integer from 20 to 1000');
const variant = [stable && 'stable', separate && 'separate', boxes && 'boxes'].filter(Boolean).join('-') || 'original';
const output = path.join(root, 'dist', 'board-debug', `jsdom-${variant}-${count}.json`);
const dir = path.join(root, 'src/shared/cubs-database/components');
const temporary = path.join(dir, `BoardView.diagnostic-${process.pid}.test.tsx`);
fs.mkdirSync(path.dirname(output), { recursive: true });
let source = fs.readFileSync(path.join(dir, 'BoardView.performance.test.tsx'), 'utf8');
if (count !== 1000) source = source.replaceAll('1000', String(count)).replaceAll('500', String(count / 2));
source = `import { writeFileSync } from 'node:fs'\n` + source;
source = source.replace('const renders = vi.hoisted', `const diagnostics = vi.hoisted(() => ({ collisions: [] as unknown[], snapshots: [] as unknown[], placeholderRects: [] as unknown[] }))
vi.mock('../lib/dragAnchor', async (original) => {
  const module = await original<typeof import('../lib/dragAnchor')>()
  return { ...module, cardTopCollisions: (...args: Parameters<typeof module.cardTopCollisions>) => {
    const result = module.cardTopCollisions(...args)
    diagnostics.collisions.push({ active: args[0].active.id, rect: args[0].collisionRect, pointer: args[0].pointerCoordinates, winners: result.slice(0, 3).map(item => ({ id: item.id, score: item.data?.value })) })
    return result
  } }
})
const renders = vi.hoisted`);
source = source.replace('vi.spyOn(HTMLElement.prototype', 'const identities = new WeakMap<HTMLElement, number>()\n  vi.spyOn(HTMLElement.prototype');
source = source.replace("const x = board?.getAttribute('data-board-column') === SECOND ? 332 : 0", `const key = board?.getAttribute('data-board-column')
    const x = key === SECOND ? 332 : ${separate} && key === '__unassigned__' ? 664 : 0
    if (${boxes} && (this.matches('[data-board-column]') || (!this.closest('[data-board-column]') && board))) return new DOMRect(x, 0, 320, 36000)`);
source = source.replace("if (card) {", `if (this.querySelector('[data-drag-placeholder]')) diagnostics.placeholderRects.push({ tag: this.tagName, cachedIndex: identities.get(this), hasCard: Boolean(card) })
    if (${stable} && identities.has(this)) return new DOMRect(x + 9, 50 + identities.get(this)! * 70, 302, 60)
    if (card) {`);
source = source.replace(`const index = Number(card.getAttribute('data-board-card')!.slice(4)) % ${count / 2}`, `const index = Number(card.getAttribute('data-board-card')!.slice(4)) % ${count / 2}\n      identities.set(this, index)`);
source = source.replace("const handle = screen.getByRole", `const snapshot = (step: string) => {
    const placeholders = [...container.querySelectorAll('[data-drag-placeholder]')].map(node => {
      const wrapper = node.parentElement?.parentElement
      return { column: node.closest('[data-board-column]')?.getAttribute('data-board-column'), ancestors: [node.parentElement?.tagName, wrapper?.tagName], previous: wrapper?.previousElementSibling?.querySelector('[data-board-card]')?.getAttribute('data-board-card'), index: wrapper?.parentElement ? [...wrapper.parentElement.children].indexOf(wrapper) : -1 }
    })
    diagnostics.snapshots.push({ step, placeholders, lanes: [...container.querySelectorAll('[data-board-column]')].map(lane => ({ id: lane.getAttribute('data-board-column'), first: [...lane.querySelectorAll('[data-board-card]')].slice(0, 12).map(node => node.getAttribute('data-board-card')) })), collisions: diagnostics.collisions.length })
    writeFileSync(${JSON.stringify(output)}, JSON.stringify(diagnostics, null, 2))
  }
  const handle = screen.getByRole`);
source = source.replace('for (let index = 0; index < 8; index++) {', "snapshot('activated')\n  for (let index = 0; index < 8; index++) {");
source = source.replace('await act(async () => { await Promise.resolve() })', "await act(async () => { await Promise.resolve() })\n    snapshot('ArrowDown-' + (index + 1))");
source = source.replace('expect(move).not.toHaveBeenCalled()', "expect(move).not.toHaveBeenCalled()\n  snapshot('cancelled')");
try {
  fs.writeFileSync(temporary, source);
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.ts', path.relative(root, temporary), '--maxWorkers=1'], { cwd: root, stdio: 'inherit' });
  console.log(`Diagnostic trace: ${output}`);
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(temporary, { force: true });
}
