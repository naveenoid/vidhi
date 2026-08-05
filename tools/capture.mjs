// Regenerates every image in docs/img/ from the game's own code.
//
//   node tools/capture.mjs
//
// Needs Playwright and a Chromium build. Nothing here ships to players - the
// game itself still loads zero image assets. Run it after changing a monster
// model, a weapon viewmodel or a map so the README stays honest.
//
// Env:
//   PW_CHROMIUM   path to a chromium binary (default: Playwright's own)
//   PW_MODULE     import specifier for playwright (default: 'playwright'),
//                 useful when it is installed globally rather than here

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { chromium } = await import(process.env.PW_MODULE || 'playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'img');
const PORT = 8123;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(PORT, r));
fs.mkdirSync(OUT, { recursive: true });

const launch = {
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox',
  ],
};
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);

const save = (name, buf) => {
  fs.writeFileSync(path.join(OUT, `${name}.png`), buf);
  console.log('  docs/img/' + name + '.png');
};

// ---------------------------------------------------------------------------
// 1. Monster portraits, rendered from the real rigs on a turntable stage
// ---------------------------------------------------------------------------
console.log('monsters');
{
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  page.on('pageerror', (e) => console.error('  !', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/tools/preview.html`);
  await page.waitForFunction('window.ready === true', { timeout: 30000 });

  const shots = [
    { name: 'asura', type: 'asura', h: 1.02, yaw: 0.6, pose: {} },
    { name: 'asura-attack', type: 'asura', h: 1.02, yaw: 0.35, pose: { windup: 1 } },
    { name: 'naga', type: 'naga', h: 1.06, yaw: 0.6, pose: {} },
    { name: 'naga-attack', type: 'naga', h: 1.06, yaw: 0.3, pose: { windup: 1 } },
    { name: 'rakshasa', type: 'rakshasa', h: 1.18, yaw: 0.6, pose: {} },
    { name: 'rakshasa-attack', type: 'rakshasa', h: 1.18, yaw: 0.3, pose: { windup: 1 } },
    { name: 'mahishasura', type: 'rakshasa', boss: true, h: 1.34, yaw: 0.5, pose: {} },
    { name: 'mahishasura-attack', type: 'rakshasa', boss: true, h: 1.34, yaw: 0.25, pose: { windup: 1 } },
  ];
  for (const s of shots) {
    await page.evaluate(([t, b, h]) => window.showMonster(t, b, h), [s.type, !!s.boss, s.h]);
    await page.evaluate((o) => window.shoot(o), {
      w: 560, h: 720, yaw: s.yaw, dist: s.h * 2.9, target: s.h * 0.52, pose: s.pose,
    });
    save(s.name, await page.locator('#c').screenshot());
  }
  await page.close();
}

// ---------------------------------------------------------------------------
// 2. Level maps, drawn from the same grids the game parses
// ---------------------------------------------------------------------------
console.log('maps');
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  page.on('pageerror', (e) => console.error('  !', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/tools/maps.html`);
  await page.waitForFunction('window.ready === true', { timeout: 30000 });
  for (let i = 0; i < 3; i++) {
    await page.evaluate((n) => window.drawLevel(n), i);
    save(`map-${i + 1}`, await page.locator('#c').screenshot());
  }
  await page.close();
}

// ---------------------------------------------------------------------------
// 3. In-game shots: each weapon in hand, and a banner
// ---------------------------------------------------------------------------
console.log('gameplay');
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  page.on('pageerror', (e) => console.error('  !', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.click('#btn-start');
  await page.waitForFunction('window.__vidhi && window.__vidhi.sprites.length > 0', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__vidhi;
    if (g.story && g.story.active) g.story.hide();
    g.gameState.weapons = ['trishul', 'agni', 'chakra', 'brahmastra'];
    g.gameState.ammo = { trishul: Infinity, agni: 40, chakra: 80, brahmastra: 12 };
  });

  // Park the player in front of a chosen monster, facing it.
  const stage = async ([level, type, boss, back]) => {
    await page.evaluate(async ([lvl]) => {
      const g = window.__vidhi;
      if (g.currentLevel !== lvl) { g.currentLevel = lvl; g.loadLevel(lvl); }
    }, [level]);
    await page.waitForTimeout(500);
    return page.evaluate(([ty, bs, bk]) => {
      const g = window.__vidhi;
      const TS = 64;
      const e = g.sprites.find((s) => s.type === ty && !!s.boss === bs && s.health > 0);
      if (!e) return false;
      g.player.x = e.x - bk * TS;
      g.player.y = e.y;
      g.player.angle = 0;
      g.player.pitch = 0.02;
      e.state = 'chase';
      g.gameState.weapons = ['trishul', 'agni', 'chakra', 'brahmastra'];
      g.gameState.ammo = { trishul: Infinity, agni: 40, chakra: 80, brahmastra: 12 };
      if (g.story && g.story.active) g.story.hide();
      return true;
    }, [type, boss, back]);
  };

  const weaponShots = [
    { name: 'weapon-trishul', weapon: 'trishul', level: 0, type: 'asura', back: 2.4 },
    { name: 'weapon-agni', weapon: 'agni', level: 0, type: 'rakshasa', back: 3.0 },
    { name: 'weapon-chakra', weapon: 'chakra', level: 0, type: 'naga', back: 3.4 },
    { name: 'weapon-brahmastra', weapon: 'brahmastra', level: 2, type: 'rakshasa', boss: true, back: 4.0 },
  ];
  for (const s of weaponShots) {
    if (!await stage([s.level, s.type, !!s.boss, s.back])) { console.log('  skip', s.name); continue; }
    await page.evaluate((w) => window.__vidhi.switchWeapon(w), s.weapon);
    await page.waitForTimeout(700);
    save(s.name, await page.locator('#game-container').screenshot());
  }

  // Banner: the boss arena, weapon drawn
  await stage([2, 'rakshasa', true, 4.6]);
  await page.evaluate(() => window.__vidhi.switchWeapon('chakra'));
  await page.waitForTimeout(800);
  save('banner', await page.locator('#game-container').screenshot());
  await page.close();
}

await browser.close();
server.close();
console.log('done');
