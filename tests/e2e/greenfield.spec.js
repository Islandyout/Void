import { test, expect } from '@playwright/test';

async function collectBrowserProblems(page) {
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`));
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

test('mobile Slice 03 touch controls do not overlap at 360x800', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const problems = await collectBrowserProblems(page);
  await page.goto('http://127.0.0.1:4173/vx2.html');
  await assertWebGL(page);
  await page.locator('#deploy').click();
  await expect(page.locator('#hud')).not.toHaveClass(/hidden/);

  const ids = ['movePad', 'fireBtn', 'adsBtn', 'reloadBtn', 'swapBtn', 'jumpBtn', 'crouchBtn', 'health'];
  const boxes = {};
  for (const id of ids) {
    boxes[id] = await page.locator(`#${id}`).boundingBox();
    expect(boxes[id], `${id} missing`).toBeTruthy();
  }
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = boxes[ids[i]];
      const b = boxes[ids[j]];
      expect(overlapArea(a, b), `${ids[i]} overlaps ${ids[j]}`).toBeLessThanOrEqual(1);
    }
  }

  await page.screenshot({ path: 'test-results/greenfield-mobile-360.png' });
  expect(problems, problems.join('\n')).toEqual([]);
  await context.close();
});
