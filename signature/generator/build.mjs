// Renders the CSS animations in render.html to looping GIFs for the email signature.
// Usage: node build.mjs   (writes ../assets/*.gif)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EXECUTABLE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '..', 'assets');
const FPS = 20;
const HOLD = 2.2; // seconds the final frame holds before the GIF loops

// id → motion seconds to capture (rest of the loop holds the last frame), plus
// optional downscale/palette overrides to keep the GIF light enough for email
const ASSETS = {
  logo: { motion: 2.5 },
  photo: { motion: 1.7, scale: 0.75, colors: 96 },
  'icon-web': { motion: 1.0 },
  'icon-ig': { motion: 1.2 },
  'icon-in': { motion: 1.4 },
  'icon-g': { motion: 1.6 },
  badge: { motion: 1.6 },
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto('file://' + path.join(HERE, 'render.html'));
await page.evaluate(() => window.assetsReady);
// let the webp/fonts settle into layout
await page.waitForTimeout(300);

for (const [id, { motion, scale = 1, colors = 128 }] of Object.entries(ASSETS)) {
  const el = page.locator('#' + id);
  const box = await el.boundingBox();
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sig-' + id + '-'));
  const n = Math.round(motion * FPS);
  for (let i = 0; i <= n; i++) {
    const t = i / FPS;
    await page.evaluate(t => window.seek(t), t);
    const f = path.join(tmp, `f${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: f, clip });
  }
  const gif = path.join(OUT, id + '.gif');
  execFileSync('python3', [path.join(HERE, 'frames2gif.py'), tmp, gif, String(FPS), String(HOLD), String(scale), String(colors)], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', gif, Math.round(fs.statSync(gif).size / 1024) + 'kB');
}

await browser.close();
