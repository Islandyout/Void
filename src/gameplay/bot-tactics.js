import * as THREE from 'three';

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

export function chooseRouteNode(botPos, goalPos, nodes, isReachable) {
  let best = null;
  let bestScore = Infinity;
  for (const node of nodes) {
    if (!isReachable(botPos, node)) continue;
    const toGoal = node.distanceTo(goalPos);
    const travel = node.distanceTo(botPos);
    const score = toGoal + travel * 0.28;
    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best ? best.clone() : null;
}

export function chooseCoverNode(botPos, playerPos, nodes, options) {
  const { isHidden, isReachable, occupied = () => false, minPlayerDistance = 7, maxPlayerDistance = 44 } = options;
  let best = null;
  let bestScore = Infinity;
  for (const node of nodes) {
    const playerDistance = node.distanceTo(playerPos);
    if (playerDistance < minPlayerDistance || playerDistance > maxPlayerDistance) continue;
    if (!isHidden(node, playerPos) || !isReachable(botPos, node) || occupied(node)) continue;
    const travel = node.distanceTo(botPos);
    const separation = Math.abs(playerDistance - 22) * 0.18;
    const coverDir = tmpA.copy(node).sub(playerPos).normalize();
    const botDir = tmpB.copy(botPos).sub(playerPos).normalize();
    const sameLanePenalty = Math.abs(coverDir.dot(botDir)) * 2.5;
    const score = travel + separation + sameLanePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best ? best.clone() : null;
}

export function updateTargetMemory(bot, visible, playerPos, dt, memorySeconds = 4.2) {
  if (visible) {
    bot.lastSeen.copy(playerPos);
    bot.memoryT = memorySeconds;
  } else {
    bot.memoryT = Math.max(0, (bot.memoryT || 0) - dt);
  }
  return bot.memoryT > 0;
}

export function tacticalState(bot, context) {
  const { visible, distance, lowHealth, atCover, hasMemory } = context;
  if (atCover && visible) return 'cover';
  if (lowHealth && visible) return 'seek-cover';
  if (visible && distance < 8) return 'disengage';
  if (visible && distance < 34) return 'pressure';
  if (visible) return 'advance';
  if (hasMemory) return 'investigate';
  return 'patrol';
}
