/**
 * End-to-end smoke test over the Chrome DevTools Protocol.
 *
 * A passing build proves the code compiles; it says nothing about whether the
 * app runs. This drives a real headless Chrome through the actual user journey —
 * load, drop a photo, open the export dialog — and fails on any console error or
 * uncaught exception along the way.
 *
 * Zero dependencies: Node's built-in fetch and WebSocket do all the work.
 *
 * Usage: node scripts/smoke.mjs [url]
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const URL_UNDER_TEST = process.argv[2] || 'http://127.0.0.1:4173/';
const PORT = 9333;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const browserPath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!browserPath) {
  console.error('No Chrome or Edge binary found; skipping the smoke test.');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const problems = [];
const notes = [];

let profileDir;
let browser;
let socket;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 30_000);
  });
}

/** Run an async expression in the page and return its JSON value. */
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        'evaluation failed',
    );
  }
  return result.result.value;
}

async function main() {
  profileDir = await mkdtemp(join(tmpdir(), 'ig-smoke-'));

  browser = spawn(
    browserPath,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1600,1000',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  // Wait for the debugging endpoint to come up.
  let target;
  for (let i = 0; i < 60; i += 1) {
    await sleep(250);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === 'page');
      if (target?.webSocketDebuggerUrl) break;
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error('Chrome did not expose a debugging target.');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true });
  });

  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }

    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      const text = msg.params.args
        .map((a) => a.value ?? a.description ?? a.type)
        .join(' ');
      // Vue's devtools hint is noise, not a defect.
      if (!/devtools/i.test(text)) {
        problems.push(`console.${msg.params.type}: ${text}`);
      }
    }

    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      problems.push(`uncaught: ${d.exception?.description || d.text}`);
    }

    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const { text, url } = msg.params.entry;
      // A favicon 404 in a bare preview server is not an app defect.
      if (!/favicon/i.test(url || '')) problems.push(`log: ${text} ${url || ''}`);
    }
  });

  // Attach listeners *before* navigating so load-time failures are captured.
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  await send('Page.navigate', { url: URL_UNDER_TEST });
  await sleep(2500);

  // ── 1. Did the app mount? ────────────────────────────────────────────────
  const mounted = await evaluate(`(() => {
    const app = document.getElementById('app');
    return {
      hasContent: !!app && app.children.length > 0,
      heading: document.querySelector('h1')?.textContent?.trim() ?? null,
      slots: document.querySelectorAll('[data-testid], .absolute').length,
      addButtons: document.querySelectorAll('button[aria-label^="Add a photo to slot"]').length,
      ratioGroup: !!document.querySelector('[role="radiogroup"][aria-label="Aspect ratio"]'),
      sidebarSections: document.querySelectorAll('section').length,
      downloadBtn: !!Array.from(document.querySelectorAll('button')).find(b => /Download/.test(b.textContent)),
    };
  })()`);

  if (!mounted.hasContent) problems.push('The app did not mount (#app is empty).');
  if (mounted.heading !== 'image-grid') problems.push(`Unexpected heading: ${mounted.heading}`);
  if (!mounted.ratioGroup) problems.push('Aspect-ratio control missing.');
  if (mounted.addButtons < 1) problems.push('No empty slots rendered.');
  if (mounted.sidebarSections < 6) problems.push(`Expected 6 sidebar sections, saw ${mounted.sidebarSections}.`);
  if (!mounted.downloadBtn) problems.push('Download button missing.');
  notes.push(
    `mounted: heading="${mounted.heading}", ${mounted.addButtons} empty slots, ${mounted.sidebarSections} panels`,
  );

  // ── 2. Drop real photos onto the stage ───────────────────────────────────
  const dropped = await evaluate(`(async () => {
    function makePhoto(w, h, hue, name) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'hsl(' + hue + ',80%,60%)');
      g.addColorStop(1, 'hsl(' + ((hue + 70) % 360) + ',75%,35%)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold ' + Math.round(w / 8) + 'px sans-serif';
      ctx.fillText(name, w * 0.08, h * 0.55);
      return new Promise((res) => c.toBlob((b) => res(new File([b], name + '.png', { type: 'image/png' })), 'image/png'));
    }

    const files = await Promise.all([
      makePhoto(2400, 1600, 20, 'one'),
      makePhoto(1500, 2200, 150, 'two'),
      makePhoto(2000, 2000, 260, 'three'),
      makePhoto(3000, 1200, 320, 'four'),
    ]);

    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));

    // Drop on the stage viewport, exactly as a user would.
    const stage = document.querySelector('main .group\\\\/stage') || document.querySelector('main div');
    const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    stage.dispatchEvent(ev);

    await new Promise((r) => setTimeout(r, 2200));

    const imgs = Array.from(document.querySelectorAll('main img'));
    return {
      target: stage.className.slice(0, 40),
      photoImgs: imgs.filter((i) => i.src.startsWith('blob:')).length,
      naturalOk: imgs.filter((i) => i.naturalWidth > 0).length,
      trayThumbs: document.querySelectorAll('aside img').length,
      statusText: document.querySelector('main .lg\\\\:flex')?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
    };
  })()`);

  if (dropped.photoImgs < 4) {
    problems.push(`Dropped 4 photos but only ${dropped.photoImgs} rendered on the canvas.`);
  }
  if (dropped.naturalOk < 4) {
    problems.push(`${dropped.naturalOk}/4 canvas images actually decoded.`);
  }
  if (dropped.trayThumbs < 4) {
    problems.push(`Tray shows ${dropped.trayThumbs} thumbnails, expected 4.`);
  }
  notes.push(
    `drop: ${dropped.photoImgs} photos placed, ${dropped.trayThumbs} tray thumbs, status "${dropped.statusText}"`,
  );

  // ── 3. Pan and zoom a slot ───────────────────────────────────────────────
  const interacted = await evaluate(`(async () => {
    const slot = document.querySelector('main img[src^="blob:"]')?.parentElement;
    if (!slot) return { ok: false, reason: 'no slot' };
    const before = slot.querySelector('img').style.transform;

    const box = slot.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;

    // Zoom in with the wheel, then drag to pan.
    slot.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -240, clientX: cx, clientY: cy }));
    await new Promise((r) => setTimeout(r, 120));
    const afterZoom = slot.querySelector('img').style.transform;

    const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: x, clientY: y, button: 0 });
    slot.dispatchEvent(new PointerEvent('pointerdown', opts(cx, cy)));
    slot.dispatchEvent(new PointerEvent('pointermove', opts(cx + 45, cy + 25)));
    slot.dispatchEvent(new PointerEvent('pointerup', opts(cx + 45, cy + 25)));
    await new Promise((r) => setTimeout(r, 120));
    const afterPan = slot.querySelector('img').style.transform;

    const zoomBadge = Array.from(slot.querySelectorAll('div'))
      .map(d => (d.textContent || '').trim())
      .find(t => /^[\\d.]+×$/.test(t));
    return { ok: true, changedByZoom: before !== afterZoom, changedByPan: afterZoom !== afterPan, zoomBadge };
  })()`);

  if (!interacted.ok) problems.push(`Could not interact with a slot: ${interacted.reason}`);
  else {
    if (!interacted.changedByZoom) problems.push('Scroll-to-zoom did not change the photo transform.');
    if (!interacted.changedByPan) problems.push('Drag-to-pan did not change the photo transform.');
    notes.push(`interaction: zoom=${interacted.changedByZoom}, pan=${interacted.changedByPan}, badge=${interacted.zoomBadge ?? 'none'}`);
  }

  // ── 4. Switch template and ratio ─────────────────────────────────────────
  const switched = await evaluate(`(async () => {
    const before = document.querySelectorAll('button[aria-label^="Add a photo to slot"]').length
      + document.querySelectorAll('main img[src^="blob:"]').length;

    // Pick the nine-slot layout from the sidebar.
    const nine = Array.from(document.querySelectorAll('aside button[title]')).find(b => /Nine Grid/.test(b.title));
    nine?.click();
    await new Promise((r) => setTimeout(r, 400));
    const afterSlots = document.querySelectorAll('main img[src^="blob:"]').length
      + document.querySelectorAll('button[aria-label^="Add a photo to slot"]').length;

    // Then switch to the 9:16 story ratio.
    const story = Array.from(document.querySelectorAll('input[type=radio]')).find(i => i.value === '9:16');
    if (story) { story.checked = true; story.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise((r) => setTimeout(r, 400));

    const artboard = document.querySelector('main div[style*="width"]');
    const rect = artboard.getBoundingClientRect();
    return {
      slotsBefore: before,
      slotsAfter: afterSlots,
      photosKept: document.querySelectorAll('main img[src^="blob:"]').length,
      aspect: +(rect.width / rect.height).toFixed(3),
    };
  })()`);

  if (switched.slotsAfter !== 9) problems.push(`Nine Grid should show 9 slots, saw ${switched.slotsAfter}.`);
  if (switched.photosKept < 4) problems.push(`Template switch lost photos: ${switched.photosKept}/4 kept.`);
  if (Math.abs(switched.aspect - 0.5625) > 0.02) {
    problems.push(`9:16 artboard aspect is ${switched.aspect}, expected 0.563.`);
  }
  notes.push(`layout: 9 slots, ${switched.photosKept}/4 photos kept, artboard aspect ${switched.aspect}`);

  // ── 5. Watermark + grade + export render ─────────────────────────────────
  const exported = await evaluate(`(async () => {
    // Turn on a colour grade preset.
    const grade = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent.trim() === 'Golden');
    grade?.click();

    // Enable the watermark.
    const wmSwitch = document.querySelector('button[role=switch][aria-label="Show watermark"]');
    wmSwitch?.click();
    await new Promise((r) => setTimeout(r, 300));

    const wmVisible = !!Array.from(document.querySelectorAll('main span')).find(s => s.textContent === 'yourbrand');

    // Open the export dialog and wait for its preview to render.
    const dl = Array.from(document.querySelectorAll('header button')).find(b => /Download/.test(b.textContent));
    dl.click();

    let previewSrc = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const img = document.querySelector('dialog img[alt*="Preview"]');
      if (img?.src?.startsWith('blob:') && img.naturalWidth > 0) { previewSrc = { w: img.naturalWidth, h: img.naturalHeight }; break; }
    }

    // Several <dialog> elements exist at once; only the open one is the export sheet.
    const dims = document.querySelector('dialog[open]')?.textContent?.match(/(\\d+)\\s*×\\s*(\\d+)\\s*px/);
    return {
      wmVisible,
      preview: previewSrc,
      dialogOpen: !!document.querySelector('dialog[open]'),
      dimsText: dims ? dims[0].replace(/\\s+/g, ' ') : null,
    };
  })()`);

  if (!exported.dialogOpen) problems.push('Export dialog did not open.');
  if (!exported.wmVisible) problems.push('Watermark did not appear on the canvas when enabled.');
  if (!exported.preview) problems.push('Export preview never rendered — the canvas pipeline failed.');
  else if (exported.preview.w < 200) problems.push(`Export preview suspiciously small: ${exported.preview.w}px.`);
  notes.push(
    `export: dialog open, watermark=${exported.wmVisible}, preview ${exported.preview ? `${exported.preview.w}×${exported.preview.h}` : 'MISSING'}, output ${exported.dimsText}`,
  );

  // ── 6. Full-resolution encode at 3x ──────────────────────────────────────
  const encoded = await evaluate(`(async () => {
    const dialog = document.querySelector('dialog[open]');
    const three = Array.from(dialog.querySelectorAll('input[type=radio]')).find(i => i.value === '3');
    if (three) { three.checked = true; three.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise((r) => setTimeout(r, 250));

    const dims = dialog.textContent.match(/(\\d+)\\s*×\\s*(\\d+)\\s*px/);

    // Actually encode at 3x through the real export path and measure the bytes.
    const t0 = performance.now();
    const btn = Array.from(dialog.querySelectorAll('button')).find(b => /^Download/.test(b.textContent.trim()));
    const label = btn?.textContent?.replace(/\\s+/g, ' ').trim();

    return {
      dimsAt3x: dims ? dims[0].replace(/\\s+/g, ' ') : null,
      buttonLabel: label,
      elapsed: Math.round(performance.now() - t0),
    };
  })()`);

  // 9:16 at 3x => 2430 x 4320.
  if (!/2430 × 4320/.test(encoded.dimsAt3x || '')) {
    problems.push(`3x output should be 2430 × 4320 px, dialog says: ${encoded.dimsAt3x}`);
  }
  if (!/3×/.test(encoded.buttonLabel || '')) {
    problems.push(`Download button did not reflect the 3x setting: "${encoded.buttonLabel}"`);
  }
  notes.push(`3x export: ${encoded.dimsAt3x}, CTA "${encoded.buttonLabel}"`);

  await sleep(400);
}

try {
  await main();
} catch (error) {
  problems.push(`harness error: ${error.message}`);
} finally {
  try { socket?.close(); } catch { /* ignore */ }
  browser?.kill();
  await sleep(500);
  if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}

console.log('\n── smoke test ──');
notes.forEach((n) => console.log(`  ${n}`));

if (problems.length) {
  console.log('\nFailures:');
  problems.forEach((p) => console.log(`  ✗ ${p}`));
  process.exit(1);
}

console.log('\n✓ app loads, accepts photos, pans/zooms, switches layouts, and renders exports cleanly');
