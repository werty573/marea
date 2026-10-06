// Records the 22 s showcase Reel and exports ad/ad.mp4 (+ ad/ad-silent.mp4).
//   node ad/record.mjs            → full render
//   node ad/record.mjs --frames   → frames only (ad/frames/final), no encode
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
const adDir = path.join(root, 'ad'), FR = path.join(adDir, 'frames');
const BASE = 'http://localhost:5173';
const onlyFrames = process.argv.includes('--frames');
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const pad = i => String(i).padStart(4, '0');
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

fs.rmSync(FR, { recursive: true, force: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', e => errors.push(`${tag}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
};

/* ---------- 1. base ---------- */
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
watch(page, 'base');
await page.goto(`${BASE}/index.html?ad=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ad-ready="1"]');
await page.evaluate(() => window.__ad.ready());
const AD = await page.evaluate(() => ({ duration: window.__ad.duration, fps: window.__ad.fps, music: window.__ad.music, slots: window.__ad.slots }));
const { duration, fps } = AD, total = Math.round(duration * fps);
const slots = AD.slots.map(s => ({ ...s, f0: Math.round(s.from * fps), f1: Math.round(s.to * fps) }));
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
    async prepare(p) {
      return p.evaluate(() => { const n = document.querySelector('#notes'); return n.getBoundingClientRect().top + scrollY + innerHeight * .55; });
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
    async frame(p, i, n) {
      if (i === 0) { await p.mouse.move(700, 600); await p.evaluate(() => window.__soda.setFlavor(1)); }
      if (i > 22) { const k = (i - 22) / (n - 23); await p.mouse.move(lerp(80, 1000, ease(k)), lerp(1300, 520, ease(k))); }
    },
  },
  'soda-blue': { url: '/soda/?cam=macro&flavor=blue', preroll: 2.2 },
};

for (const s of slots) {
  const c = CLIPS[s.name], n = s.f1 - s.f0;
  const ctx = await browser.newContext({ viewport: c.viewport || { width: 1080, height: 1920 }, deviceScaleFactor: c.dpr || 1, isMobile: !!c.mobile, hasTouch: !!c.mobile });
  const p = await ctx.newPage(); watch(p, s.name);
  const start = Date.now() + 60000;
  await p.clock.install({ time: start - 1000 });
  await p.clock.pauseAt(start);
  await p.goto(BASE + c.url, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);                       // real time for textures/HDRI to finish decoding
  await p.clock.runFor(Math.round(c.preroll * 1000));
  const extra = c.prepare ? await c.prepare(p) : null;
  const dir = path.join(FR, s.name); fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) {
    if (c.frame) await c.frame(p, i, n, extra);
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
const M = AD.music, music = path.join(adDir, 'music.m4a');
const sr = 44100, S = t => Math.round(t * sr), fade = .004, segs = M.segs;
// a third value stretches that segment to the given length (rubberband: tempo only, pitch unchanged),
// then trims/pads to the exact sample count so nothing after it drifts
const parts = segs.map(([a, b, len], i) =>
  `[s${i}]atrim=start_sample=${S(a)}:end_sample=${S(b)},asetpts=PTS-STARTPTS` +
  (len ? `,rubberband=tempo=${((b - a) / len).toFixed(6)}:transients=mixed:pitchq=quality:channels=together,atrim=end_sample=${S(len)},apad=whole_len=${S(len)}` : '') +
  (i ? `,afade=t=in:d=${fade}` : '') + (i < segs.length - 1 ? `,afade=t=out:st=${((len || b - a) - fade).toFixed(4)}:d=${fade}` : '') + `[p${i}]`);
const graph = `[0:a]aresample=${sr},asplit=${segs.length}${segs.map((_, i) => `[s${i}]`).join('')};` +
  parts.join(';') + ';' + segs.map((_, i) => `[p${i}]`).join('') + `concat=n=${segs.length}:v=0:a=1[out]`;
ff('-i', path.join(root, 'reference/reel.mp4'), '-filter_complex', graph, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), music);

/* ---------- 6. encode ---------- */
const capOn = slots.map(s => `between(n,${s.f0},${s.f1 - 1})`).join('+');
const vIn = ['-framerate', String(fps), '-start_number', '0', '-i', path.join(OUT, 'f_%04d.jpg'), '-i', path.join(FR, 'caption.png')];
const vf = `[0:v][1:v]overlay=0:0:enable='${capOn}',format=yuv420p[v]`;
const enc = ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '16', '-r', String(fps), '-movflags', '+faststart'];
ff(...vIn, '-filter_complex', vf, '-map', '[v]', ...enc, '-an', path.join(adDir, 'ad-silent.mp4'));
ff(...vIn, '-i', music, '-filter_complex', vf, '-map', '[v]', '-map', '2:a', ...enc, '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', String(duration), path.join(adDir, 'ad.mp4'));
console.log(`done → ad/ad.mp4, ad/ad-silent.mp4 (${total} frames, ${duration}s)`);
