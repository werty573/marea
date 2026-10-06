// Records index.html?ad=1 frame-by-frame at 1080x1920 and exports the Instagram Reel.
//   node ad/record.mjs            → ad/ad.mp4 (with music) + ad/ad-silent.mp4
//   node ad/record.mjs --frames   → only render frames (for checking)
// Every frame i is rendered at exactly t = i / 30 s, so cuts land on the beat timestamps in reference/beats.json.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { server } from '../scripts/serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const adDir = path.join(root, 'ad');
const framesDir = path.join(adDir, 'frames');
const onlyFrames = process.argv.includes('--frames');
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5173/index.html?ad=1', { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ad-ready="1"]');
await page.evaluate(() => window.__ad.ready());
const { duration, fps, music: M } = await page.evaluate(() => ({ duration: window.__ad.duration, fps: window.__ad.fps, music: window.__ad.music }));
const total = Math.round(duration * fps);           // 8.1 s × 30 = 243 frames

const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate(i => window.__ad.frame(i), i);
  await page.screenshot({ path: path.join(framesDir, `f_${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
  if (i % 30 === 0) process.stdout.write(`frame ${i}/${total}  (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}
await browser.close();
server.close();
if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
if (onlyFrames) process.exit(0);

// music: the reference reel's audio at full quality. The reel is only 8.1 s, so the drop phrase
// [p1, p2) is repeated `loops` extra times (sample-accurate cuts just before each drop transient,
// 4 ms edge fades so the seams don't click), then the original ending plays out.
const music = path.join(adDir, 'music.m4a');
const sr = 44100, S = t => Math.round(t * sr), fade = .004;
const segs = [[0, M.p2], ...Array(M.loops).fill([M.p1, M.p2]), [M.p2, M.src]];
const parts = segs.map(([a, b], i) =>
  `[s${i}]atrim=start_sample=${S(a)}:end_sample=${S(b)},asetpts=PTS-STARTPTS` +
  (i ? `,afade=t=in:d=${fade}` : '') + (i < segs.length - 1 ? `,afade=t=out:st=${(b - a - fade).toFixed(4)}:d=${fade}` : '') + `[p${i}]`);
const graph = `[0:a]aresample=${sr},asplit=${segs.length}${segs.map((_, i) => `[s${i}]`).join('')};` +
  parts.join(';') + ';' + segs.map((_, i) => `[p${i}]`).join('') + `concat=n=${segs.length}:v=0:a=1[out]`;
ff('-i', path.join(root, 'reference/reel.mp4'), '-filter_complex', graph, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), music);

const vArgs = ['-framerate', String(fps), '-start_number', '0', '-i', path.join(framesDir, 'f_%04d.jpg')];
const enc = ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart'];
ff(...vArgs, ...enc, '-an', path.join(adDir, 'ad-silent.mp4'));
// both streams start at t=0; -t pins the exact length so neither stream drifts or pads
ff(...vArgs, '-i', music, '-map', '0:v', '-map', '1:a', ...enc, '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', String(duration), path.join(adDir, 'ad.mp4'));
console.log(`done → ad/ad.mp4, ad/ad-silent.mp4 (${total} frames, ${duration}s)`);
