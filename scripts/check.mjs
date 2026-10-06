// Playwright smoke test: console errors + screenshots at desktop and phone sizes
import { chromium } from 'playwright';
import './serve.mjs';
const url = 'http://localhost:5173/';
const out = process.argv[2] || 'shots';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${name}-0-preloader.png` });
  await page.waitForTimeout(6000);
  if (!mobile) { await page.mouse.move(900, 400, { steps: 8 }); await page.mouse.move(700, 500, { steps: 8 }); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-1-hero.png` });
  if (!mobile) {
    await page.click('.scent-btn[data-scent="2"]'); await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/${name}-2-switch-mid.png` });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${out}/${name}-3-switched.png` });
  }
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const stops = [0.07, 0.15, 0.25, 0.33, 0.45, 0.55, 0.66, 0.74, 0.84, 1];
  for (const [k, f] of stops.entries()) {
    await page.evaluate(y => window.scrollTo(0, y), Math.round((H - vp.height) * f));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${name}-s${String(k).padStart(2, '0')}.png` });
  }
  console.log(name, 'scrollHeight', H, 'errors:', errs.length ? '\n  ' + errs.join('\n  ') : 'none');
  await ctx.close();
}
await browser.close(); process.exit(0);
