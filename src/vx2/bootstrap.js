import qualityCss from './quality.css?raw';
import { VX2_BUILD, FEEDBACK_TIMINGS } from '../core/tuning.js';

const frame = document.querySelector('#vx2Game');

function pulse(doc, className, duration) {
  const body = doc.body;
  body.classList.remove(className);
  requestAnimationFrame(() => {
    body.classList.add(className);
    window.setTimeout(() => body.classList.remove(className), duration);
  });
}

function leadingAmmo(el) {
  const match = el?.textContent?.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function installQualityPass(doc) {
  if (!doc?.head || !doc?.body || doc.body.dataset.vx2Installed) return;
  doc.body.dataset.vx2Installed = '1';
  doc.body.classList.add('vx2');

  const style = doc.createElement('style');
  style.dataset.vx2 = 'quality-pass-01';
  style.textContent = qualityCss;
  doc.head.appendChild(style);

  const badge = doc.createElement('div');
  badge.id = 'vx2BuildBadge';
  badge.innerHTML = `<strong>${VX2_BUILD.name}</strong><span>${VX2_BUILD.channel} · ${VX2_BUILD.version}</span>`;
  doc.body.appendChild(badge);

  const feedback = doc.createElement('div');
  feedback.id = 'vx2Feedback';
  doc.body.appendChild(feedback);

  const hud = doc.querySelector('#hud');
  const paintBadge = () => {
    badge.hidden = !!hud?.classList.contains('active');
  };
  if (hud) {
    new MutationObserver(paintBadge).observe(hud, { attributes: true, attributeFilter: ['class'] });
    paintBadge();
  }

  const ammo = doc.querySelector('#ammoCounter');
  if (ammo) {
    let previous = leadingAmmo(ammo);
    new MutationObserver(() => {
      const current = leadingAmmo(ammo);
      if (current !== null && previous !== null && current < previous) {
        pulse(doc, 'vx2-shot', FEEDBACK_TIMINGS.shot);
      }
      previous = current;
    }).observe(ammo, { subtree: true, childList: true, characterData: true });
  }

  const hitmarker = doc.querySelector('#hitmarker');
  if (hitmarker) {
    new MutationObserver(() => {
      if (hitmarker.classList.contains('show')) pulse(doc, 'vx2-hit', FEEDBACK_TIMINGS.hit);
    }).observe(hitmarker, { attributes: true, attributeFilter: ['class'] });
  }

  const killFeed = doc.querySelector('#killFeed');
  if (killFeed) {
    new MutationObserver(records => {
      if (records.some(record => record.addedNodes.length)) {
        pulse(doc, 'vx2-kill', FEEDBACK_TIMINGS.kill);
      }
    }).observe(killFeed, { childList: true });
  }

  const damage = doc.querySelector('#dmgFlash');
  if (damage) {
    new MutationObserver(() => {
      const alpha = Number((getComputedStyle(damage).backgroundColor.match(/[\d.]+/g) || [0, 0, 0, 0])[3] || 0);
      if (alpha > 0.05) pulse(doc, 'vx2-damaged', FEEDBACK_TIMINGS.damage);
    }).observe(damage, { attributes: true, attributeFilter: ['style'] });
  }

  const centerMessage = doc.querySelector('#centerMsg');
  if (centerMessage) {
    new MutationObserver(() => {
      if (centerMessage.classList.contains('show')) pulse(doc, 'vx2-objective', FEEDBACK_TIMINGS.objective);
    }).observe(centerMessage, { attributes: true, attributeFilter: ['class'] });
  }

  console.info(`[${VX2_BUILD.name}] ${VX2_BUILD.milestone} installed`);
}

frame.addEventListener('load', () => {
  try {
    installQualityPass(frame.contentDocument);
  } catch (error) {
    console.error('[VOXSTRIKE 2.0] Quality pass could not attach:', error);
  }
});
