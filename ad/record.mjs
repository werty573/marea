// Records a Reel and exports it:
//   node ad/record.mjs [1|2|3|4]        → ad 1: ad/ad.mp4 · ad N: ad/adN.mp4 (+ -silent versions)
//   node ad/record.mjs 2 --frames       → frames only (ad/frames/ad2/final), no encode
//   node ad/record.mjs 2 --reuse        → keep already-recorded site clips
//
// 1. Base: index.html?ad=1 (1080×1920) — DM hook, MAREA shots, end card. Frame i is rendered at exactly
//    t = i / 30 by seeking a GSAP timeline and stepping fixed-dt physics, so every cut lands on its beat.
// 2. Live-site clips: the real MAREA site (phone layout, scrolling) and the soda can site, recorded with
//    Playwright's fake clock (1/30 s per frame) and spliced into the slots the base timeline leaves black.
// 3. The caption is rendered once as a transparent PNG and laid over the spliced clips (the base draws its own).
// 4. Music: the reference reel's audio, intro time-stretched (no repeats) and the drop phrase looped
//    (sample-accurate cuts just before onsets, 4 ms seam fades), muxed from t = 0.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { server } from '../scripts/serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const N = +(process.argv.find(a => /^[1-9]$/.test(a)) || 1), sfx = N === 1 ? '' : String(N);
const adDir = path.join(root, 'ad'), FR = path.join(adDir, 'frames', 'ad' + N);
const BASE = 'http://localhost:5173';
const onlyFrames = process.argv.includes('--frames'), reuse = process.argv.includes('--reuse');
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const pad = i => String(i).padStart(4, '0');
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// keep recorded site clips with --reuse (handy while tweaking the timeline)
for (const d of fs.existsSync(FR) ? fs.readdirSync(FR) : []) if (!(reuse && d === 'clips')) fs.rmSync(path.join(FR, d), { recursive: true, force: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
};

/* ---------- 1. base ---------- */
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
watch(page, 'base');
await page.goto(`${BASE}/index.html?ad=${N}`, { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ad-ready="1"]');
await page.evaluate(() => window.__ad.ready());
const AD = await page.evaluate(() => ({ duration: window.__ad.duration, fps: window.__ad.fps, music: window.__ad.music, slots: window.__ad.slots, clips: window.__ad.clips || [], stills: window.__ad.stills || [] }));
const { duration, fps } = AD, total = Math.round(duration * fps);
const slots = AD.slots.map(s => ({ ...s, f0: Math.round(s.from * fps), f1: Math.round(s.to * fps) }));
/* ---------- 1a. clip specs from the ad page: live sites in phone / browser frames ---------- */
// helpers injected into every recorded page; action expressions use them
const HELPERS = `window.__c = (s, n = 0) => { const e = document.querySelectorAll(s)[n]; if (!e) return [0, 0]; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
window.__lc = (s, n = 0) => { const e = document.querySelectorAll(s)[n]; if (!e) return [0, 0]; const t = e.closest('label') || e.parentElement; const r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
window.__top = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : 0; };`;
// a visible pointer: an arrow on desktop, a tap ring on phones (it presses while the mouse is down)
const CURSOR = kind => `(() => { const K = ${JSON.stringify(kind)};
  const mk = () => { if (document.getElementById('__cur')) return; const c = document.createElement('div'); c.id = '__cur';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px)';
    c.innerHTML = K === 'touch'
      ? '<i style="position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.32);border:3px solid rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(0,0,0,.35)"></i>'
      : '<svg width="36" height="42" viewBox="0 0 17 20" style="position:absolute;left:-3px;top:-2px;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))"><path d="M1 1 L1 16 L5 12.5 L8 19 L10.8 17.8 L7.9 11.4 L13 11.4 Z" fill="#fff" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { const i = c.firstElementChild; i.style.scale = K === 'touch' ? '.72' : '.86'; if (K === 'touch') i.style.background = 'rgba(255,255,255,.75)'; }, true);
    addEventListener('mouseup', () => { const i = c.firstElementChild; i.style.scale = '1'; if (K === 'touch') i.style.background = 'rgba(255,255,255,.32)'; }, true); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mk); else mk(); })();`;

async function recordSpec(c) {
  const dir = path.join(FR, 'clips', c.name);
  if (reuse && fs.existsSync(path.join(dir, `f_${pad(c.frames - 1)}.jpg`))) return console.log(`${c.name}: reused`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  if (c.video) {                                   // a still taken from reference footage
    ff('-ss', String(c.at || 0), '-i', path.join(root, c.video), '-frames:v', '1', '-vf', 'scale=1080:1920:flags=lanczos', '-q:v', '2', path.join(dir, 'f_0000.jpg'));
    return console.log(`${c.name}: still from footage`);
  }
  const ctx = await browser.newContext({ viewport: { width: c.vp[0], height: c.vp[1] }, deviceScaleFactor: c.dpr, isMobile: !!c.mobile, hasTouch: !!c.mobile });
  const p = await ctx.newPage(); watch(p, c.name);
  await p.addInitScript(HELPERS);
  if (c.cursor) await p.addInitScript(CURSOR(c.cursor));
  const start = Date.now() + 60000;
  await p.clock.install({ time: start - 1000 });
  await p.clock.pauseAt(start);
  await p.goto(c.url.startsWith('http') ? c.url : BASE + c.url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
  await p.clock.runFor(Math.round(c.preroll * 1000));
  const val = async v => (typeof v === 'string' ? p.evaluate(v) : v);
  const scrollTo = async y => (c.lenis
    ? p.evaluate(y => window.__lenis.scrollTo(y, { immediate: true, force: true }), Math.round(y))
    : p.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(y)));
  if (c.prescroll) { await scrollTo(await val(c.prescroll)); await p.clock.runFor(1400); }
  const A = c.actions || [];
  const mouseKeys = A.find(a => a.mouse)?.mouse, scrollKeys = A.find(a => a.scroll)?.scroll;
  const scrollCache = new Map();
  const interp = async (keys, i, resolve) => {
    let k = keys.findIndex((x, j) => j === keys.length - 1 || keys[j + 1][0] > i);
    const a = keys[Math.max(0, Math.min(k, keys.length - 1))], b = keys[Math.min(k + 1, keys.length - 1)];
    const va = await resolve(a, k), vb = await resolve(b, k + 1);
    const t = b[0] === a[0] ? 1 : Math.min(Math.max((i - a[0]) / (b[0] - a[0]), 0), 1);
    return Array.isArray(va) ? [lerp(va[0], vb[0], ease(t)), lerp(va[1], vb[1], ease(t))] : lerp(va, vb, ease(t));
  };
  const resolveMouse = async key => (key.length >= 3 ? [key[1], key[2]] : val(key[1]));
  const resolveScroll = async (key, j) => { if (!scrollCache.has(j)) scrollCache.set(j, await val(key[1])); return scrollCache.get(j); };
  if (mouseKeys) { const [x, y] = await interp(mouseKeys, 0, resolveMouse); await p.mouse.move(x, y); }
  for (let i = 0; i < c.frames; i++) {
    if (scrollKeys && i <= scrollKeys[scrollKeys.length - 1][0] && i >= scrollKeys[0][0]) await scrollTo(await interp(scrollKeys, i, resolveScroll));
    if (mouseKeys) { const [x, y] = await interp(mouseKeys, i, resolveMouse); await p.mouse.move(x, y); }
    for (const a of A) {
      if (a.click === i) await p.mouse.down();
      if (a.click === i - 3) await p.mouse.up();
      if (a.type && i >= a.type[0] && i <= a.type[1]) {
        const [f0, f1, sel, text] = a.type, n = Math.ceil(text.length * (i - f0 + 1) / (f1 - f0 + 1));
        await p.evaluate(([sel, v]) => { const e = document.querySelector(sel); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }, [sel, text.slice(0, n)]);
      }
      if (a.js && a.js[0] === i) await p.evaluate(a.js[1]);
    }
    await p.clock.runFor(1000 / fps);
    await p.screenshot({ path: path.join(dir, `f_${pad(i)}.jpg`), type: 'jpeg', quality: 92 });
  }
  console.log(`${c.name}: ${c.frames} frames`);
  await ctx.close();
}
for (const c of [...AD.clips, ...AD.stills]) await recordSpec(c);
await page.evaluate(() => window.__ad.prepare());

fs.mkdirSync(path.join(FR, 'base'), { recursive: true });
let t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate(i => window.__ad.frame(i), i);
  if (!slots.some(s => i >= s.f0 && i < s.f1))     // slot frames get replaced anyway
    await page.screenshot({ path: path.join(FR, 'base', `f_${pad(i)}.jpg`), type: 'jpeg', quality: 95 });
}
console.log(`base: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await page.close();

/* ---------- 2. live-site clips ---------- */
const CLIPS = {
  // the real MAREA site in its phone layout: hero → manifesto → into the pinned notes
  'marea-scroll': {
    url: '/index.html?dpr=3', viewport: { width: 360, height: 640 }, dpr: 3, mobile: true, preroll: 7.8,
    async prepare(p, o) {
      return p.evaluate(([sel, frac]) => { const n = document.querySelector(sel); return n.getBoundingClientRect().top + scrollY + innerHeight * frac; }, [o.target || '#notes', o.frac ?? .55]);
    },
    async frame(p, i, n, y1) {
      const k = Math.min(Math.max((i - 4) / (n - 10), 0), 1);
      await p.evaluate(y => window.__lenis.scrollTo(y, { immediate: true, force: true }), Math.round(lerp(0, y1, ease(k))));
    },
  },
  // soda hero: the entrance plays, then a cursor tilts the can and pushes cherries around
  'soda-hero': {
    url: '/soda/', preroll: .4,
    async frame(p, i, n) {
      const k = i / (n - 1);
      await p.mouse.move(lerp(900, 260, ease(k)), 760 + Math.sin(k * Math.PI * 1.4) * 360);
    },
  },
  'soda-macro': { url: '/soda/?cam=macro', preroll: 1.2 },
  // flavour switch on the first frame; the swap (spin peak) lands 0.45 s later, on the block's hit
  'soda-switch': {
    url: '/soda/', preroll: 4.2,
    async frame(p, i, n, _, o) {
      const at = o.clickAt || 0;
      if (i === at) { await p.mouse.move(700, 600); await p.evaluate(() => window.__soda.setFlavor(1)); }
      if (i > at + 22) { const k = (i - at - 22) / Math.max(n - at - 23, 1); await p.mouse.move(lerp(80, 1000, ease(k)), lerp(1300, 520, ease(k))); }
    },
  },
  'soda-blue': { url: '/soda/?cam=macro&flavor=blue', preroll: 2.2 },
};

for (const s of slots) {
  const n = s.f1 - s.f0, o = s.opts || {}, dir = path.join(FR, s.name);
  fs.mkdirSync(dir, { recursive: true });
  if (s.video) {                                   // original reference footage, resampled to 30 fps / 1080×1920
    ff('-ss', String(s.srcFrom || 0), '-i', path.join(root, s.video), '-vf', 'fps=30,scale=1080:1920:flags=lanczos', '-frames:v', String(n), '-q:v', '2', '-start_number', '0', path.join(dir, 'f_%04d.jpg'));
    console.log(`${s.name}: ${n} frames (footage)`); continue;
  }
  const c = CLIPS[s.name];
  const ctx = await browser.newContext({ viewport: c.viewport || { width: 1080, height: 1920 }, deviceScaleFactor: c.dpr || 1, isMobile: !!c.mobile, hasTouch: !!c.mobile });
  const p = await ctx.newPage(); watch(p, s.name);
  const start = Date.now() + 60000;
  await p.clock.install({ time: start - 1000 });
  await p.clock.pauseAt(start);
  await p.goto(BASE + c.url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);                       // real time for textures/HDRI to finish decoding
  await p.clock.runFor(Math.round(c.preroll * 1000));
  const extra = c.prepare ? await c.prepare(p, o) : null;
  for (let i = 0; i < n; i++) {
    if (c.frame) await c.frame(p, i, n, extra, o);
    await p.clock.runFor(1000 / fps);
    await p.screenshot({ path: path.join(dir, `f_${pad(i)}.jpg`), type: 'jpeg', quality: 95 });
  }
  console.log(`${s.name}: ${n} frames`);
  await ctx.close();
}

/* ---------- 3. caption PNG (same type as the base page) ---------- */
const cp = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await cp.setContent(`<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@700&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:transparent}.c{position:absolute;left:0;right:0;top:1150px;text-align:center;font:700 66px/1.1 'Inter Tight',sans-serif;letter-spacing:-.01em;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.6)}</style>
<div class="c">Your loss lil bro</div>`, { waitUntil: 'networkidle' });
await cp.evaluate(() => document.fonts.ready);
await cp.screenshot({ path: path.join(FR, 'caption.png'), omitBackground: true });
await browser.close();
server.close();
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].join('\n  '));

/* ---------- 4. splice ---------- */
const OUT = path.join(FR, 'final'); fs.mkdirSync(OUT, { recursive: true });
for (let i = 0; i < total; i++) {
  const s = slots.find(s => i >= s.f0 && i < s.f1);
  fs.copyFileSync(s ? path.join(FR, s.name, `f_${pad(i - s.f0)}.jpg`) : path.join(FR, 'base', `f_${pad(i)}.jpg`), path.join(OUT, `f_${pad(i)}.jpg`));
}
if (onlyFrames) process.exit(0);

/* ---------- 5. music ---------- */
const M = AD.music, music = path.join(adDir, `music${sfx}.m4a`);
const sr = 44100, S = t => Math.round(t * sr), fade = .004, segs = M.segs;
// a third value stretches that segment to the given length (rubberband: tempo only, pitch unchanged),
// then trims/pads to the exact sample count so nothing after it drifts
const parts = segs.map(([a, b, len], i) =>
  `[s${i}]atrim=start_sample=${S(a)}:end_sample=${S(b)},asetpts=PTS-STARTPTS` +
  (len ? `,rubberband=tempo=${((b - a) / len).toFixed(6)}:transients=mixed:pitchq=quality:channels=together,atrim=end_sample=${S(len)},apad=whole_len=${S(len)}` : '') +
  (i ? `,afade=t=in:d=${fade}` : '') + (i < segs.length - 1 ? `,afade=t=out:st=${((len || b - a) - fade).toFixed(4)}:d=${fade}` : '') + `[p${i}]`);
const graph = `[0:a]aresample=${sr},asplit=${segs.length}${segs.map((_, i) => `[s${i}]`).join('')};` +
  parts.join(';') + ';' + segs.map((_, i) => `[p${i}]`).join('') + `concat=n=${segs.length}:v=0:a=1[out]`;
ff('-i', path.join(root, M.file), '-filter_complex', graph, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), music);

/* ---------- 6. encode ---------- */
const capOn = slots.filter(s => s.caption).map(s => `between(n,${s.f0},${s.f1 - 1})`).join('+') || '0';
const vIn = ['-framerate', String(fps), '-start_number', '0', '-i', path.join(OUT, 'f_%04d.jpg'), '-i', path.join(FR, 'caption.png')];
const vf = `[0:v][1:v]overlay=0:0:enable='${capOn}',format=yuv420p[v]`;
const enc = ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '16', '-r', String(fps), '-movflags', '+faststart'];
ff(...vIn, '-filter_complex', vf, '-map', '[v]', ...enc, '-an', path.join(adDir, `ad${sfx}-silent.mp4`));
ff(...vIn, '-i', music, '-filter_complex', vf, '-map', '[v]', '-map', '2:a', ...enc, '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', String(duration), path.join(adDir, `ad${sfx}.mp4`));
console.log(`done → ad/ad${sfx}.mp4, ad/ad${sfx}-silent.mp4 (${total} frames, ${duration}s)`);
