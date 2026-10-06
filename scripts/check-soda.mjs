// Playwright check for the soda site: console errors + screenshots (desktop, portrait, macro, flavour switch)
// node scripts/check-soda.mjs <outdir>
import { chromium } from 'playwright';
import { server } from './serve.mjs';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, vp, q] of [['desk', { width: 1440, height: 900 }, ''], ['port', { width: 1080, height: 1920 }, ''], ['macro', { width: 1080, height: 1920 }, '?cam=macro']]) {
  const p = await b.newPage({ viewport: vp });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://localhost:5173/soda/' + q, { waitUntil: 'networkidle' });
  await p.waitForTimeout(4500);
  await p.mouse.move(vp.width * .58, vp.height * .4, { steps: 8 }); await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/soda-${name}.png` });
  if (name === 'desk') {
    await p.click('.card[data-flavor="1"]'); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/soda-${name}-mid.png` });
    await p.waitForTimeout(1800); await p.screenshot({ path: `${out}/soda-${name}-blue.png` });
  }
  console.log(name, errs.length ? errs.join(' | ') : 'no errors');
  await p.close();
}
await b.close(); server.close();
