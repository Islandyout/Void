import { test, expect } from '@playwright/test';

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
    return {
      webgl2: Boolean(canvas.getContext('webgl2')),
      webgl: Boolean(canvas.getContext('webgl')),
    };
  });
  expect(support.webgl2 || support.webgl, `WebGL unavailable: ${JSON.stringify(support)}`).toBeTruthy();
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

async function switchWhenReady(page, key, expectedName, attempts = 12) {
  for (let i = 0; i < attempts; i += 1) {
    await page.keyboard.press(key);
    if ((await page.locator('#weaponName').textContent()) === expectedName) return;
    await page.waitForTimeout(350);
  }
  await expect(page.locator('#weaponName')).toHaveText(expectedName);
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

async function assertMobileLayout(page) {
  const ids = ['movePad', 'fireBtn', 'adsBtn', 'reloadBtn', 'swapBtn', 'jumpBtn', 'crouchBtn', 'health'];
  const boxes = {};
  for (const id of ids) {
    boxes[id] = await page.locator(`#${id}`).boundingBox();
    expect(boxes[id], `${id} missing`).toBeTruthy();
  }
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      expect(overlapArea(boxes[ids[i]], boxes[ids[j]]), `${ids[i]} overlaps ${ids[j]}`).toBeLessThanOrEqual(1);
    }
  }
}

async function openQa(page) {
  await page.goto('http://127.0.0.1:4173/vx2.html?qa=1');
  await assertWebGL(page);
  await page.locator('#deploy').click();
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
  await expect.poll(() => page.evaluate(() => Boolean(window.__VX2_QA__)), { timeout: 5000 }).toBeTruthy();
  await page.evaluate(() => window.__VX2_QA__.parkBots());
}

test('desktop Slice 03 renders and traversal/combat controls respond', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await page.goto('http://127.0.0.1:4173/vx2.html');
  await assertWebGL(page);
  await expect(page.locator('#deploy')).toBeVisible();
  await page.locator('#deploy').click();
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
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
  // This is a software-renderer smoke/regression signal, not a real-device FPS target.
  expect(fps.fps).toBeGreaterThan(2);

  await page.screenshot({ path: 'test-results/greenfield-desktop.png' });
  expect(problems, problems.join('\n')).toEqual([]);
});

test('known Greenfield mantle edge reaches the top surface', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await openQa(page);
  await page.evaluate(() => window.__VX2_QA__.teleportPlayer(-12, 0, -40.05, Math.PI, 0));
  await page.keyboard.press('Space');

  await expect.poll(
    () => page.evaluate(() => window.__VX2_QA__.playerState().mantleT),
    { timeout: 3000, intervals: [100, 150, 250] },
  ).toBeGreaterThan(0);

  await expect.poll(
    () => page.evaluate(() => window.__VX2_QA__.playerState().y),
    { timeout: 5000, intervals: [150, 250, 400] },
  ).toBeGreaterThan(1.05);

  await expect.poll(
    () => page.evaluate(() => window.__VX2_QA__.playerState().mantleT),
    { timeout: 5000, intervals: [150, 250, 400] },
  ).toBe(0);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('warehouse stairs connect to the mezzanine without snagging', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await openQa(page);
  await page.evaluate(() => window.__VX2_QA__.teleportPlayer(-21.3, 0, -47.25, 0, 0));
  await page.keyboard.down('KeyW');

  await expect.poll(
    () => page.evaluate(() => window.__VX2_QA__.playerState().y),
    { timeout: 9000, intervals: [250, 350, 500] },
  ).toBeGreaterThan(2.4);
  await page.keyboard.up('KeyW');

  const state = await page.evaluate(() => window.__VX2_QA__.playerState());
  expect(state.z).toBeLessThan(-52.5);
  expect(state.grounded).toBeTruthy();
  expect(problems, problems.join('\n')).toEqual([]);
});

test('low-health bot selects and moves toward valid cover', async ({ page }) => {
  const problems = await collectBrowserProblems(page);
  await openQa(page);

  const placements = [
    { player: [0, 0, -30], bot: [18, 0, -30] },
    { player: [2, 0, -26], bot: [25, 0, -26] },
    { player: [20, 0, -8], bot: [-8, 0, -8] },
    { player: [-12, 0, 18], bot: [15, 0, 18] },
    { player: [-18, 0, -25], bot: [18, 0, -25] },
  ];

  let chosen = null;
  for (const placement of placements) {
    const result = await page.evaluate(({ player, bot }) => {
      window.__VX2_QA__.parkBots();
      window.__VX2_QA__.teleportPlayer(player[0], player[1], player[2], 0, 0);
      window.__VX2_QA__.activateBot(0, bot[0], bot[1], bot[2], 45);
      return window.__VX2_QA__.coverCandidate(0);
    }, placement);
    if (!result) continue;

    const start = await page.evaluate(() => window.__VX2_QA__.botStates()[0]);
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => window.__VX2_QA__.botStates()[0]);
    if (after.cover && ['seek-cover', 'cover'].includes(after.state)) {
      chosen = { start, after, candidate: result };
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

for (const device of [
  { name: 'portrait 360x800', width: 360, height: 800 },
  { name: 'landscape 800x360', width: 800, height: 360 },
]) {
  test(`mobile Slice 03 controls do not overlap in ${device.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const problems = await collectBrowserProblems(page);
    await page.goto('http://127.0.0.1:4173/vx2.html');
    await assertWebGL(page);
    await page.locator('#deploy').tap();
    await expect(page.locator('#hud')).not.toHaveClass(/hidden/);
    await assertMobileLayout(page);

    await page.locator('#swapBtn').tap();
    await expect(page.locator('#weaponName')).toHaveText('P9 SIDEARM');
    await page.locator('#crouchBtn').tap();
    await expect(page.locator('#stance')).toHaveText('CROUCH');

    await page.screenshot({ path: `test-results/greenfield-mobile-${device.width}x${device.height}.png` });
    expect(problems, problems.join('\n')).toEqual([]);
    await context.close();
  });
}
