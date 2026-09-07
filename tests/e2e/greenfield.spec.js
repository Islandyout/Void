import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173/vx2.html';
const QA_BASE = `${BASE}?qa=1`;

async function collectBrowserProblems(page) {
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  return problems;
}

async function assertWebGL(page) {
  const support = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return { webgl2: Boolean(canvas.getContext('webgl2')), webgl: Boolean(canvas.getContext('webgl')) };
  });
  expect(support.webgl2 || support.webgl, `WebGL unavailable: ${JSON.stringify(support)}`).toBeTruthy();
}

async function deploy(page, { qa = false, parkBots = false } = {}) {
  await page.goto(qa ? QA_BASE : BASE);
  await assertWebGL(page);
  await expect(page.locator('#deploy')).toBeVisible();
  await page.locator('#deploy').click();
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
  if (qa) {
    await expect.poll(() => page.evaluate(() => Boolean(window.__VX2_QA__))).toBeTruthy();
    if (parkBots) await page.evaluate(() => window.__VX2_QA__.parkBots());
  }
}

async function sampleFps(page, milliseconds = 3000) {
  return page.evaluate(ms => new Promise(resolve => {
    let frames = 0;
    const start = performance.now();
    const frame = now => {
      frames += 1;
      if (now - start >= ms) {
        resolve({ frames, elapsed: now - start, fps: frames * 1000 / (now - start) });
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }), milliseconds);
}

async function switchWhenReady(page, key, expectedName, attempts = 16) {
  for (let i = 0; i < attempts; i += 1) {
    await page.keyboard.press(key);
    if ((await page.locator('#weaponName').textContent()) === expectedName) return;
    await page.waitForTimeout(300);
  }
  await expect(page.locator('#weaponName')).toHaveText(expectedName);
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

async function assertMobileLayout(browser, viewport, label) {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/153 Mobile Safari/537.36',
  });
  const page = await context.newPage();
  const problems = await collectBrowserProblems(page);
  await deploy(page, { qa: true, parkBots: true });
  const ids = ['movePad', 'fireBtn', 'adsBtn', 'reloadBtn', 'swapBtn', 'jumpBtn', 'crouchBtn', 'health'];
  const boxes = {};
  for (const id of ids) {
    boxes[id] = await page.locator(`#${id}`).boundingBox();
    expect(boxes[id], `${label}: ${id} missing`).toBeTruthy();
    expect(boxes[id].x, `${label}: ${id} left overflow`).toBeGreaterThanOrEqual(-1);
    expect(boxes[id].y, `${label}: ${id} top overflow`).toBeGreaterThanOrEqual(-1);
    expect(boxes[id].x + boxes[id].width, `${label}: ${id} right overflow`).toBeLessThanOrEqual(viewport.width + 1);
    expect(boxes[id].y + boxes[id].height, `${label}: ${id} bottom overflow`).toBeLessThanOrEqual(viewport.height + 1);
  }
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      expect(overlapArea(boxes[ids[i]], boxes[ids[j]]), `${label}: ${ids[i]} overlaps ${ids[j]}`).toBeLessThanOrEqual(1);
    }
  }
  await page.locator('#crouchBtn').tap();
  await expect(page.locator('#stance')).toHaveText('CROUCH');
  await page.locator('#crouchBtn').tap();
  await expect(page.locator('#stance')).toHaveText('READY');
  await page.locator('#swapBtn').tap();
  await expect.poll(() => page.locator('#weaponName').textContent(), { timeout: 5000 }).toBe('P9 SIDEARM');
  expect(problems, problems.join('\n')).toEqual([]);
  await context.close();
}

test('desktop Slice 03 renders and traversal controls respond', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await deploy(page, { qa: true, parkBots: true });
  await expect(page.locator('#stance')).toHaveText('READY');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(900);
  await page.keyboard.down('KeyC');
  await page.waitForTimeout(90);
  await expect(page.locator('#stance')).toHaveText('SLIDE');
  await page.keyboard.up('KeyC');
  await page.waitForTimeout(850);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyC');
  await page.waitForTimeout(120);
  await expect(page.locator('#stance')).toHaveText('CROUCH');
  await page.keyboard.up('KeyC');
  await page.waitForTimeout(150);
  await expect(page.locator('#stance')).toHaveText('READY');
  await switchWhenReady(page, 'Digit2', 'P9 SIDEARM');
  await switchWhenReady(page, 'Digit3', 'BRUTE-12');
  const fps = await sampleFps(page, 3000);
  console.log(`VX2 SwiftShader frame sample: ${fps.fps.toFixed(1)} fps over ${fps.elapsed.toFixed(0)} ms`);
  expect(fps.fps).toBeGreaterThan(2);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('known Greenfield mantle edge reaches the cover top cleanly', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await deploy(page, { qa: true, parkBots: true });
  await page.evaluate(() => window.__VX2_QA__.teleportPlayer(-12, 0, -40.05, Math.PI, 0));
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.__VX2_QA__.playerState().mantleT), { timeout: 3000, intervals: [80, 120, 180] }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__VX2_QA__.playerState().y), { timeout: 5000 }).toBeGreaterThan(1.05);
  await expect.poll(() => page.evaluate(() => window.__VX2_QA__.playerState().mantleT), { timeout: 5000 }).toBe(0);
  const state = await page.evaluate(() => window.__VX2_QA__.playerState());
  expect(state.grounded).toBeTruthy();
  expect(state.y).toBeGreaterThanOrEqual(1.1);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('warehouse staircase connects ground floor to the mezzanine', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await deploy(page, { qa: true, parkBots: true });
  await page.evaluate(() => window.__VX2_QA__.teleportPlayer(-21.3, 0, -47.4, 0, 0));
  await page.keyboard.down('KeyW');
  try {
    await expect.poll(() => page.evaluate(() => window.__VX2_QA__.playerState().y), { timeout: 10000, intervals: [150, 250, 400] }).toBeGreaterThan(2.45);
  } finally {
    await page.keyboard.up('KeyW');
  }
  const state = await page.evaluate(() => window.__VX2_QA__.playerState());
  expect(state.z).toBeLessThan(-53.5);
  expect(state.grounded).toBeTruthy();
  expect(problems, problems.join('\n')).toEqual([]);
});

test('low-health bot selects hidden cover and advances toward it', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await deploy(page, { qa: true, parkBots: true });
  const placements = [
    { player: [0, 0, -30], bot: [18, 0, -30] },
    { player: [2, 0, -26], bot: [25, 0, -26] },
    { player: [20, 0, -8], bot: [-8, 0, -8] },
    { player: [-12, 0, 18], bot: [15, 0, 18] },
    { player: [-18, 0, -25], bot: [18, 0, -25] },
  ];
  let chosen = null;
  for (const placement of placements) {
    const candidate = await page.evaluate(({ player, bot }) => {
      window.__VX2_QA__.parkBots();
      window.__VX2_QA__.teleportPlayer(player[0], player[1], player[2], 0, 0);
      window.__VX2_QA__.activateBot(0, bot[0], bot[1], bot[2], 45);
      return window.__VX2_QA__.coverCandidate(0);
    }, placement);
    if (!candidate) continue;
    const start = await page.evaluate(() => window.__VX2_QA__.botStates()[0]);
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => window.__VX2_QA__.botStates()[0]);
    if (after.cover && /seek-cover|cover/.test(after.state)) {
      chosen = { candidate, start, after };
      break;
    }
  }
  expect(chosen, 'No deterministic placement produced active cover behavior').toBeTruthy();
  const startDistance = Math.hypot(chosen.start.x - chosen.candidate.x, chosen.start.z - chosen.candidate.z);
  const endDistance = Math.hypot(chosen.after.x - chosen.candidate.x, chosen.after.z - chosen.candidate.z);
  expect(endDistance).toBeLessThan(startDistance);
  expect(chosen.after.hp).toBeLessThanOrEqual(45);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('Android touch layouts stay usable in portrait and landscape', async ({ browser }) => {
  await assertMobileLayout(browser, { width: 360, height: 800 }, '360x800');
  await assertMobileLayout(browser, { width: 412, height: 915 }, '412x915');
  await assertMobileLayout(browser, { width: 800, height: 360 }, '800x360');
  await assertMobileLayout(browser, { width: 915, height: 412 }, '915x412');
});
