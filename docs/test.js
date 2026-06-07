function showTestToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showTestToast.timer);
  showTestToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

const ACTIVE_CROSSHAIR_KEY = "aimlock_active_crosshair";
const SENSITIVITY_KEY = "aimlock_test_sensitivity";
const BEST_RECORD_PREFIX = "aimlock_test_best_";
const MOUSE_SENS_BASE = 0.0022;
const SENS_MIN = 25;
const SENS_MAX = 300;
const SENS_DEFAULT = 100;
const DEFAULT_CROSSHAIR =
  "0;P;c;5;o;1;d;1;0b;0;1b;0;S;c;5;o;1;d;1;0b;0;1b;0;";

const WALL_Z = -3200;
const FLOOR_Y = -240;
const HALL_HALF = 1150;

const PLAYER = {
  eyeY: 130,
  speed: 420,
  boundsX: [-620, 620],
  boundsZ: [-120, 200],
};

/** OW 훈련장 거리 구간 */
const RANGE_ROWS = [
  { z: -1050, label: "10m", scale: 0.92, moveSpan: 540 },
  { z: -1650, label: "20m", scale: 0.76, moveSpan: 500 },
  { z: -2250, label: "30m", scale: 0.62, moveSpan: 460 },
  { z: -2850, label: "40m", scale: 0.52, moveSpan: 420 },
];

function spawnHumanTarget() {
  const tier = RANGE_ROWS[Math.floor(Math.random() * RANGE_ROWS.length)];
  const speed = (85 + Math.random() * 175) * (Math.random() < 0.5 ? -1 : 1);
  const bodyH = 62 * tier.scale;
  const bodyW = 36 * tier.scale;
  const y = FLOOR_Y + bodyH * 0.58;
  return {
    id: `human-${Math.random().toString(36).slice(2, 9)}`,
    type: "human",
    x: (Math.random() - 0.5) * tier.moveSpan * 0.35,
    y,
    z: tier.z,
    scale: tier.scale,
    distLabel: tier.label,
    distM: parseInt(tier.label, 10),
    bodyH,
    bodyW,
    headR: 15 * tier.scale,
    r: 30 * tier.scale,
    moveMinX: -tier.moveSpan / 2,
    moveMaxX: tier.moveSpan / 2,
    moveVelX: speed,
    platformH: 0,
    hit: false,
    active: true,
    respawnAt: 0,
    hitFlash: 0,
  };
}

function buildRangeTargets() {
  return [spawnHumanTarget()];
}

const LANE_COLORS = ["#4ebabf", "#f99e1a", "#e85d75"];

/** 총별 스프레이 패턴 (왼쪽=발사 경로, pitch=위로, yaw=우측) */
function buildSpray(entries) {
  return entries.map(([p, y]) => ({ p, y }));
}

const SPRAY_PATTERNS = {
  vandal: buildSpray([
    [0.010, 0.0], [0.011, 0.0], [0.012, 0.001], [0.013, 0.001], [0.014, 0.002],
    [0.013, 0.006], [0.012, 0.010], [0.011, 0.014], [0.010, 0.018],
    [0.009, -0.012], [0.008, -0.018], [0.007, -0.024], [0.006, -0.028], [0.005, -0.030],
    [0.005, -0.028], [0.004, -0.022], [0.004, -0.014], [0.004, -0.006],
    [0.004, 0.008], [0.004, 0.016], [0.003, 0.022], [0.003, 0.018], [0.003, 0.012], [0.003, 0.006],
  ]),
  phantom: buildSpray([
    [0.008, 0.0], [0.009, 0.0], [0.010, 0.0], [0.010, 0.001], [0.010, 0.002],
    [0.009, 0.005], [0.008, 0.008], [0.008, 0.010],
    [0.007, -0.006], [0.007, 0.008], [0.006, -0.010], [0.006, 0.012], [0.006, -0.012], [0.005, 0.014],
    [0.005, -0.010], [0.005, 0.008], [0.004, -0.008], [0.004, 0.010], [0.004, -0.006], [0.004, 0.004],
  ]),
  sheriff: buildSpray([[0.028, 0.0]]),
  operator: buildSpray([[0.048, 0.0]]),
  operatorZoom: buildSpray([[0.010, 0.0]]),
};

const WEAPONS = {
  vandal: {
    label: "Vandal",
    desc: "연사 · AK형 스프레이 · 위→우→좌→우",
    auto: true,
    resetMs: 500,
    recovery: 10,
    shake: 7,
    spread: [
      { min: 1, max: 1, rMin: 0, rMax: 0 },
      { min: 2, max: 5, rMin: 5, rMax: 15 },
      { min: 6, max: 10, rMin: 15, rMax: 35 },
      { min: 11, max: Infinity, rMin: 35, rMax: 60 },
    ],
    fireInterval: 100,
  },
  phantom: {
    label: "Phantom",
    desc: "연사 · M4형 스프레이 · 상단 지그재그",
    auto: true,
    resetMs: 400,
    recovery: 12,
    shake: 5.5,
    spread: [
      { min: 1, max: 1, rMin: 0, rMax: 0 },
      { min: 2, max: 5, rMin: 3, rMax: 10 },
      { min: 6, max: 10, rMin: 10, rMax: 25 },
      { min: 11, max: Infinity, rMin: 25, rMax: 45 },
    ],
    fireInterval: 100,
  },
  sheriff: {
    label: "Sheriff",
    desc: "단발 · 강한 수직 킥 · 첫 발 정확",
    auto: false,
    resetMs: 0,
    recovery: 16,
    shake: 11,
    spread: [{ min: 1, max: Infinity, rMin: 0, rMax: 0 }],
    fireInterval: 400,
  },
  operator: {
    label: "Operator",
    desc: "저격 · 큰 반동 · 우클릭 줌",
    auto: false,
    resetMs: 0,
    recovery: 8,
    shake: 16,
    spread: [{ min: 1, max: Infinity, rMin: 20, rMax: 20 }],
    zoomSpread: [{ min: 1, max: Infinity, rMin: 0, rMax: 0 }],
    fireInterval: 1200,
  },
};

const MODES = {
  practice: {
    label: "훈련장 연습",
    desc: "한 번에 하나씩 등장하는 이동 표적을 맞히세요.",
  },
  reaction: {
    label: "반응속도 테스트",
    desc: "30초 동안 활성화된 더미를 빠르게 제거하세요.",
  },
  accuracy: {
    label: "정확도 테스트",
    desc: "50개의 더미를 모두 제거하세요.",
  },
  spray: {
    label: "연사 테스트",
    desc: "원거리 벽 표적에 연사하여 탄착군을 확인하세요.",
  },
};

const testState = {
  weapon: "vandal",
  mode: "practice",
  running: false,
  finished: false,
  locked: false,
  crosshairCode: DEFAULT_CROSSHAIR,
  zoomed: false,
  posX: 0,
  posZ: 0,
  bobPhase: 0,
  bobOffset: 0,
  keys: { left: false, right: false, forward: false, back: false },
  velX: 0,
  velZ: 0,
  activeTargetId: null,
  rangeTargets: [],
  sensitivity: SENS_DEFAULT,
  yaw: 0,
  pitch: 0,
  recoilPitch: 0,
  recoilYaw: 0,
  shakeX: 0,
  shakeY: 0,
  shotCount: 0,
  lastFireAt: 0,
  resetTimer: null,
  autoFireTimer: null,
  holdingFire: false,
  hits: 0,
  shots: 0,
  reactionTimes: [],
  targetSpawnAt: 0,
  targetsRemaining: 0,
  targetsTotal: 0,
  elapsedMs: 0,
  timeLeft: 30,
  timerId: null,
  targets: [],
  impacts: [],
  centerTarget: null,
};

const testEls = {};

function getViewSize() {
  const canvas = testEls.canvas;
  const dpr = window.devicePixelRatio || 1;
  if (!canvas) return { w: 800, h: 450, dpr };
  return {
    w: canvas.width / dpr,
    h: canvas.height / dpr,
    dpr,
  };
}

function getFovRad() {
  const { w, h } = getViewSize();
  if (testState.weapon === "operator" && testState.zoomed) return (36 * Math.PI) / 180;
  const hFov = (100 * Math.PI) / 180;
  return 2 * Math.atan(Math.tan(hFov / 2) * (h / Math.max(w, 1)));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function getSpreadRadius(weaponKey, shotCount, zoomed) {
  const w = WEAPONS[weaponKey];
  const rules = weaponKey === "operator" && zoomed ? w.zoomSpread : w.spread;
  let spread = 0;
  for (const rule of rules) {
    if (shotCount >= rule.min && shotCount <= rule.max) {
      if (rule.rMin === rule.rMax) spread = rule.rMin;
      else spread = rule.rMin + Math.random() * (rule.rMax - rule.rMin);
      break;
    }
  }
  return spread + getMovementSpreadBonus();
}

function isPlayerMoving() {
  return Math.hypot(testState.velX, testState.velZ) > 25;
}

function getMovementSpreadBonus() {
  if (!isPlayerMoving()) return 0;
  const ratio = clamp(Math.hypot(testState.velX, testState.velZ) / PLAYER.speed, 0, 1);
  return 14 + ratio * 42;
}

function getMovementRecoilMult() {
  if (!isPlayerMoving()) return 1;
  const ratio = clamp(Math.hypot(testState.velX, testState.velZ) / PLAYER.speed, 0, 1);
  return 1 + ratio * 0.55;
}

function loadActiveCrosshair() {
  try {
    const saved = localStorage.getItem(ACTIVE_CROSSHAIR_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_CROSSHAIR;
}

function saveActiveCrosshair(code) {
  try {
    localStorage.setItem(ACTIVE_CROSSHAIR_KEY, code);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("aimlock:crosshair-change", { detail: { code } }));
}

function loadSensitivity() {
  try {
    const saved = Number(localStorage.getItem(SENSITIVITY_KEY));
    if (Number.isFinite(saved)) return clamp(saved, SENS_MIN, SENS_MAX);
  } catch {
    /* ignore */
  }
  return SENS_DEFAULT;
}

function saveSensitivity(value) {
  try {
    localStorage.setItem(SENSITIVITY_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function getMouseSensitivity() {
  return MOUSE_SENS_BASE * (testState.sensitivity / SENS_DEFAULT);
}

function syncSensitivityUI() {
  const val = testState.sensitivity;
  if (testEls.sensSlider) testEls.sensSlider.value = String(val);
  if (testEls.sensValue) testEls.sensValue.textContent = `${val}%`;
}

function setSensitivity(value, { persist = true } = {}) {
  testState.sensitivity = clamp(Math.round(value), SENS_MIN, SENS_MAX);
  syncSensitivityUI();
  if (persist) saveSensitivity(testState.sensitivity);
}

function canChangeSettings() {
  return !testState.running || !testState.locked;
}

function bestRecordKey(mode, weapon) {
  return `${BEST_RECORD_PREFIX}${mode}_${weapon}`;
}

function loadBestRecord(mode, weapon) {
  try {
    const raw = localStorage.getItem(bestRecordKey(mode, weapon));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBestRecord(mode, weapon, record) {
  try {
    localStorage.setItem(bestRecordKey(mode, weapon), JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

function formatMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return `${Math.round(ms)}ms`;
}

function formatPct(n) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function avgReactionTime() {
  if (!testState.reactionTimes.length) return 0;
  return testState.reactionTimes.reduce((a, b) => a + b, 0) / testState.reactionTimes.length;
}

function accuracyPct() {
  if (!testState.shots) return 0;
  return (testState.hits / testState.shots) * 100;
}

function getEffectiveAim() {
  return {
    yaw: testState.yaw + testState.recoilYaw,
    pitch: clamp(testState.pitch + testState.recoilPitch, -1.35, 1.35),
  };
}

function getSprayPattern(weaponKey) {
  if (weaponKey === "operator" && testState.zoomed) return SPRAY_PATTERNS.operatorZoom;
  return SPRAY_PATTERNS[weaponKey] || SPRAY_PATTERNS.vandal;
}

function getSprayStep(weaponKey, shotIndex) {
  const pattern = getSprayPattern(weaponKey);
  const step = pattern[(shotIndex - 1) % pattern.length];
  return step;
}

function isVerticalRecoilWeapon(weaponKey) {
  return !WEAPONS[weaponKey]?.auto;
}

function applyScreenShake(intensity) {
  if (isVerticalRecoilWeapon(testState.weapon)) {
    testState.shakeY -= intensity * 1.35;
    testState.shakeY += (Math.random() - 0.5) * intensity * 0.45;
    testState.shakeX += (Math.random() - 0.5) * intensity * 0.35;
    return;
  }
  testState.shakeX += (Math.random() - 0.5) * intensity * 2.8;
  testState.shakeY += (Math.random() - 0.5) * intensity * 2.8;
  testState.shakeY -= intensity * 0.35;
}

function applyRecoilKick() {
  const cfg = WEAPONS[testState.weapon];
  const step = getSprayStep(testState.weapon, testState.shotCount);
  const moveMult = getMovementRecoilMult();
  // pitch(+)=아래를 봄 → 반동(위)은 pitch를 줄여야 함
  testState.recoilPitch -= step.p * moveMult;
  if (cfg.auto) {
    testState.recoilYaw += step.y * moveMult;
    testState.recoilYaw = clamp(testState.recoilYaw, -0.35, 0.35);
  }
  testState.recoilPitch = Math.max(testState.recoilPitch, -0.55);
  applyScreenShake((cfg.shake || 5) * moveMult);
}

function updateScreenShake(dt) {
  const decay = Math.exp(-16 * dt);
  testState.shakeX *= decay;
  testState.shakeY *= decay;
  if (Math.abs(testState.shakeX) < 0.05) testState.shakeX = 0;
  if (Math.abs(testState.shakeY) < 0.05) testState.shakeY = 0;
}

function updateRecoilRecovery(dt) {
  if (!testState.running || testState.finished) {
    if (!testState.running) {
      const factor = Math.exp(-14 * dt);
      testState.recoilPitch *= factor;
      testState.recoilYaw *= factor;
    }
    return;
  }
  const cfg = WEAPONS[testState.weapon];
  const rate = testState.holdingFire ? cfg.recovery * 0.3 : cfg.recovery * 1.6;
  const factor = Math.exp(-rate * dt);
  testState.recoilPitch *= factor;
  testState.recoilYaw *= factor;
  if (Math.abs(testState.recoilPitch) < 0.00004) testState.recoilPitch = 0;
  if (Math.abs(testState.recoilYaw) < 0.00004) testState.recoilYaw = 0;
}

function resetRecoil() {
  testState.recoilPitch = 0;
  testState.recoilYaw = 0;
  testState.shakeX = 0;
  testState.shakeY = 0;
}

function vec3(x, y, z) {
  return { x, y, z };
}

function vecNormalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return vec3(v.x / len, v.y / len, v.z / len);
}

function vecCross(a, b) {
  return vec3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

function getCameraPos() {
  return vec3(testState.posX, PLAYER.eyeY + testState.bobOffset, testState.posZ);
}

function getProjectionScale(viewH) {
  return viewH / (2 * Math.tan(getFovRad() / 2));
}

function getCameraBasis() {
  const aim = getEffectiveAim();
  const forward = vecNormalize(
    vec3(
      Math.sin(aim.yaw) * Math.cos(aim.pitch),
      -Math.sin(aim.pitch),
      -Math.cos(aim.yaw) * Math.cos(aim.pitch)
    )
  );
  const worldUp = vec3(0, 1, 0);
  let right = vecCross(forward, worldUp);
  if (Math.hypot(right.x, right.y, right.z) < 0.0001) {
    right = vec3(1, 0, 0);
  } else {
    right = vecNormalize(right);
  }
  const up = vecNormalize(vecCross(right, forward));
  return { forward, right, up };
}

/** 화면 픽셀 → 3D 발사 방향 (조준점 = 화면 중앙) */
function screenToWorldRay(sx, sy, viewW, viewH) {
  const scale = getProjectionScale(viewH);
  const nx = (sx - viewW / 2) / scale;
  const ny = (viewH / 2 - sy) / scale;
  const { forward, right, up } = getCameraBasis();
  return vecNormalize(
    vec3(
      forward.x + right.x * nx + up.x * ny,
      forward.y + right.y * nx + up.y * ny,
      forward.z + right.z * nx + up.z * ny
    )
  );
}

function getCrosshairRay(spreadPx, viewW, viewH) {
  let sx = viewW / 2;
  let sy = viewH / 2;
  if (spreadPx > 0) {
    const a = Math.random() * Math.PI * 2;
    const d = spreadPx * Math.random();
    sx += Math.cos(a) * d;
    sy += Math.sin(a) * d;
  }
  return screenToWorldRay(sx, sy, viewW, viewH);
}

function worldToScreen(wx, wy, wz, viewW, viewH) {
  const cam = getCameraPos();
  const rx = wx - cam.x;
  const ry = wy - cam.y;
  const rz = wz - cam.z;
  const { forward, right, up } = getCameraBasis();
  const depth = rx * forward.x + ry * forward.y + rz * forward.z;
  if (depth <= 20) return null;
  const projR = rx * right.x + ry * right.y + rz * right.z;
  const projU = rx * up.x + ry * up.y + rz * up.z;
  const scale = getProjectionScale(viewH);
  return {
    sx: viewW / 2 + (projR / depth) * scale,
    sy: viewH / 2 - (projU / depth) * scale,
    scale: scale / depth,
    depth,
  };
}

function getCurrentHumanTarget() {
  return testState.rangeTargets.find((t) => t.type === "human" && !t.hit) || null;
}

function initRangeSession() {
  testState.targets = [];
  testState.centerTarget = null;
  testState.activeTargetId = null;

  if (testState.mode === "spray") {
    testState.rangeTargets = [];
    testState.centerTarget = {
      id: "spray-wall",
      x: 0,
      y: 60,
      z: WALL_Z + 50,
      r: 70,
      scale: 0.55,
      hit: false,
      active: true,
      type: "wall",
    };
    testState.impacts = [];
    return;
  }

  const bot = spawnHumanTarget();
  testState.rangeTargets = [bot];
  testState.activeTargetId = bot.id;
  testState.targetSpawnAt = performance.now();
}

function getActiveTargets() {
  if (testState.mode === "spray" && testState.centerTarget) return [testState.centerTarget];
  return testState.rangeTargets.filter((t) => t.active && !t.hit);
}

function onTargetHit(target, now) {
  target.hit = true;
  target.hitFlash = 1;
  target.active = false;
  target.respawnAt = now + (testState.mode === "practice" ? 750 : 550);

  if (testState.mode === "reaction") {
    testState.reactionTimes.push(now - testState.targetSpawnAt);
  } else if (testState.mode === "accuracy") {
    testState.targetsRemaining -= 1;
    if (testState.targetsRemaining <= 0) finishTest();
  }
}

function spawnNextReactionTarget() {
  const bot = spawnHumanTarget();
  testState.rangeTargets = [bot];
  testState.activeTargetId = bot.id;
  testState.targetSpawnAt = performance.now();
}

function activateNextAccuracyTarget() {
  spawnNextReactionTarget();
}

function replaceHumanTarget(now) {
  const bot = spawnHumanTarget();
  testState.rangeTargets = [bot];
  testState.activeTargetId = bot.id;
  testState.targetSpawnAt = now;
}

function updateRangeTargets(dt) {
  const now = performance.now();
  for (let i = 0; i < testState.rangeTargets.length; i += 1) {
    const t = testState.rangeTargets[i];
    if (t.type !== "human") continue;

    if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 3.5);

    if (t.hit && t.respawnAt && now >= t.respawnAt) {
      if (testState.mode !== "accuracy" || testState.targetsRemaining > 0) {
        replaceHumanTarget(now);
      }
      continue;
    }

    if (!t.hit && testState.running) {
      t.x += t.moveVelX * dt;
      if (t.x <= t.moveMinX) {
        t.x = t.moveMinX;
        t.moveVelX = Math.abs(t.moveVelX) * (0.7 + Math.random() * 0.65);
      }
      if (t.x >= t.moveMaxX) {
        t.x = t.moveMaxX;
        t.moveVelX = -Math.abs(t.moveVelX) * (0.7 + Math.random() * 0.65);
      }
      if (Math.random() < dt * 0.12) {
        t.moveVelX = -t.moveVelX * (0.85 + Math.random() * 0.45);
      }
    }
  }
}

function updatePlayerMovement(dt) {
  if (!testState.running || !testState.locked) {
    testState.velX *= 0.8;
    testState.velZ *= 0.8;
    testState.bobOffset *= 0.85;
    return;
  }
  let mx = 0;
  let mz = 0;
  if (testState.keys.left) mx -= 1;
  if (testState.keys.right) mx += 1;
  if (testState.keys.forward) mz -= 1;
  if (testState.keys.back) mz += 1;
  const len = Math.hypot(mx, mz) || 1;
  mx /= len;
  mz /= len;
  testState.velX = mx * PLAYER.speed;
  testState.velZ = mz * PLAYER.speed;
  testState.posX = clamp(testState.posX + testState.velX * dt, PLAYER.boundsX[0], PLAYER.boundsX[1]);
  testState.posZ = clamp(testState.posZ + testState.velZ * dt, PLAYER.boundsZ[0], PLAYER.boundsZ[1]);
  if (mx !== 0 || mz !== 0) {
    testState.bobPhase += dt * 11;
    testState.bobOffset = Math.sin(testState.bobPhase) * 4;
  } else {
    testState.velX = 0;
    testState.velZ = 0;
    testState.bobOffset *= 0.85;
  }
}

function clearMovementKeys() {
  testState.keys.left = false;
  testState.keys.right = false;
  testState.keys.forward = false;
  testState.keys.back = false;
}

function spawnWallTarget(centered = false) {
  const x = centered ? 0 : (Math.random() - 0.5) * 900;
  const y = centered ? 40 : (Math.random() - 0.5) * 420 + 30;
  const z = centered ? -1100 : -900 - Math.random() * 350;
  return { x, y, z, r: centered ? 70 : 55, hit: false, id: Math.random() };
}

function resetWeaponSpray() {
  testState.shotCount = 0;
  if (testState.resetTimer) {
    clearTimeout(testState.resetTimer);
    testState.resetTimer = null;
  }
}

function scheduleSprayReset() {
  const weapon = WEAPONS[testState.weapon];
  if (!weapon.resetMs) return;
  if (testState.resetTimer) clearTimeout(testState.resetTimer);
  testState.resetTimer = setTimeout(() => {
    testState.shotCount = 0;
    resetRecoil();
    testState.resetTimer = null;
  }, weapon.resetMs);
}

function canFireNow() {
  return performance.now() - testState.lastFireAt >= WEAPONS[testState.weapon].fireInterval;
}

function getAimRay(spreadPx, viewW, viewH) {
  const cam = getCameraPos();
  const dir = getCrosshairRay(spreadPx, viewW, viewH);
  return { ox: cam.x, oy: cam.y, oz: cam.z, dx: dir.x, dy: dir.y, dz: dir.z };
}

function rayHitSphereDetailed(ray, target) {
  const ocX = ray.ox - target.x;
  const ocY = ray.oy - target.y;
  const ocZ = ray.oz - target.z;
  const b = 2 * (ocX * ray.dx + ocY * ray.dy + ocZ * ray.dz);
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - target.r * target.r;
  const disc = b * b - 4 * c;
  if (disc < 0) return { hit: false };
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t <= 0) return { hit: false };
  return {
    hit: true,
    t,
    x: ray.ox + ray.dx * t,
    y: ray.oy + ray.dy * t,
    z: ray.oz + ray.dz * t,
  };
}

function humanScreenBounds(target, bodyP) {
  const s = bodyP.scale;
  const bodyH = Math.max(36, target.bodyH * s);
  const bodyW = Math.max(18, target.bodyW * s);
  const headR = Math.max(10, target.headR * s);
  const cx = bodyP.sx;
  const footY = bodyP.sy + bodyH * 0.42;
  const bodyTop = footY - bodyH;
  const headCy = bodyTop - headR * 0.85;
  return { cx, bodyTop, footY, bodyW, bodyH, headR, headCy };
}

function pointInHumanScreen(sx, sy, b) {
  if (Math.hypot(sx - b.cx, sy - b.headCy) <= b.headR * 1.25) return true;
  const halfW = b.bodyW * 0.58;
  if (sx >= b.cx - halfW && sx <= b.cx + halfW && sy >= b.bodyTop && sy <= b.footY) return true;
  const shHalf = b.bodyW * 0.72;
  const shTop = b.bodyTop + b.bodyH * 0.08;
  const shBot = shTop + b.bodyH * 0.2;
  return sx >= b.cx - shHalf && sx <= b.cx + shHalf && sy >= shTop && sy <= shBot;
}

function rayHitHumanDetailed(ray, target, viewW, viewH) {
  if (Math.abs(ray.dz) < 0.0001) return { hit: false };
  const t = (target.z - ray.oz) / ray.dz;
  if (t <= 0) return { hit: false };
  const wx = ray.ox + ray.dx * t;
  const wy = ray.oy + ray.dy * t;
  const hitScreen = worldToScreen(wx, wy, target.z, viewW, viewH);
  const bodyScreen = worldToScreen(target.x, target.y, target.z, viewW, viewH);
  if (!hitScreen || !bodyScreen) return { hit: false };
  const bounds = humanScreenBounds(target, bodyScreen);
  if (!pointInHumanScreen(hitScreen.sx, hitScreen.sy, bounds)) return { hit: false };
  return { hit: true, t, x: wx, y: wy, z: target.z };
}

function rayHitTargetDetailed(ray, target, viewW, viewH) {
  if (target.type === "human") return rayHitHumanDetailed(ray, target, viewW, viewH);
  return rayHitSphereDetailed(ray, target);
}

function rayWallHit(ray, wallZ = WALL_Z) {
  if (ray.dz >= -0.0001) return null;
  const t = (wallZ - ray.oz) / ray.dz;
  if (t <= 0) return null;
  return {
    x: ray.ox + ray.dx * t,
    y: ray.oy + ray.dy * t,
    z: wallZ,
  };
}

function fireBullet() {
  if (!testState.running || testState.finished) return;
  if (!canFireNow()) return;

  const { w, h } = getViewSize();
  const now = performance.now();
  testState.lastFireAt = now;
  testState.shotCount += 1;
  testState.shots += 1;
  scheduleSprayReset();

  const spread = getSpreadRadius(testState.weapon, testState.shotCount, testState.zoomed);
  const ray = getAimRay(spread, w, h);
  let hit = false;
  let impactPoint = null;

  const checkList = getActiveTargets();

  for (const t of checkList) {
    const hitInfo = rayHitTargetDetailed(ray, t, w, h);
    if (hitInfo.hit) {
      hit = true;
      impactPoint = { x: hitInfo.x, y: hitInfo.y, z: hitInfo.z };
      testState.hits += 1;
      if (testState.mode === "spray") {
        /* wall target stays */
      } else {
        onTargetHit(t, now);
      }
      break;
    }
  }

  if (!impactPoint) {
    const wallHit = rayWallHit(ray);
    if (wallHit) impactPoint = wallHit;
  }
  if (impactPoint) {
    testState.impacts.push({ x: impactPoint.x, y: impactPoint.y, z: impactPoint.z, hit, at: now });
    if (testState.impacts.length > 120) testState.impacts.shift();
  }

  applyRecoilKick();
  updateStatsUI();
}

function startAutoFire() {
  if (!WEAPONS[testState.weapon].auto) return;
  stopAutoFire();
  testState.autoFireTimer = setInterval(() => {
    if (testState.holdingFire) fireBullet();
  }, WEAPONS[testState.weapon].fireInterval);
}

function stopAutoFire() {
  if (testState.autoFireTimer) {
    clearInterval(testState.autoFireTimer);
    testState.autoFireTimer = null;
  }
}

function resizeCanvas() {
  const wrap = testEls.rangeWrap;
  const canvas = testEls.canvas;
  if (!wrap || !canvas) return;
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  let w = Math.floor(rect.width);
  let h = Math.floor(rect.height);
  if (h < 80 && w > 80) h = Math.round(w * 9 / 16);
  if (w < 80 && h > 80) w = Math.round(h * 16 / 9);
  w = Math.max(480, w);
  h = Math.max(270, h);
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getHorizonY(h) {
  return h * (0.5 + Math.min(0.06, (h / Math.max(getViewSize().w, 1)) * 0.04));
}

function drawPlatformWing(ctx, w, h, side) {
  const aim = getEffectiveAim();
  if (aim.pitch > 0.45) return;

  const sign = side === "left" ? -1 : 1;
  const x = sign * 920;
  const zNear = -1380;
  const zFar = -1920;
  const yBase = FLOOR_Y;
  const yTop = FLOOR_Y + 155;

  const corners = [
    worldToScreen(x, yBase, zNear, w, h),
    worldToScreen(x, yBase, zFar, w, h),
    worldToScreen(x, yTop, zFar, w, h),
    worldToScreen(x, yTop, zNear, w, h),
  ];
  if (corners.some((p) => !p)) return;

  ctx.fillStyle = side === "left" ? "rgba(232, 220, 200, 0.92)" : "rgba(228, 216, 198, 0.92)";
  ctx.beginPath();
  ctx.moveTo(corners[0].sx, corners[0].sy);
  corners.slice(1).forEach((p) => ctx.lineTo(p.sx, p.sy));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(249, 158, 26, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const railA = worldToScreen(x, yTop + 8, zNear, w, h);
  const railB = worldToScreen(x, yTop + 8, zFar, w, h);
  if (railA && railB) {
    ctx.strokeStyle = "rgba(78, 186, 191, 0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(railA.sx, railA.sy);
    ctx.lineTo(railB.sx, railB.sy);
    ctx.stroke();
  }
}

function drawFpsScene(ctx, w, h) {
  const horizon = getHorizonY(h);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#7eb8bc");
  sky.addColorStop(0.55, "#b8cdb8");
  sky.addColorStop(1, "#ddd0ba");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const floor = ctx.createLinearGradient(0, horizon, 0, h);
  floor.addColorStop(0, "#f0ebe3");
  floor.addColorStop(0.35, "#e4dbd0");
  floor.addColorStop(1, "#c8bfb0");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  const backWallZ = WALL_Z;
  const wallTL = worldToScreen(-HALL_HALF, 360, backWallZ, w, h);
  const wallTR = worldToScreen(HALL_HALF, 360, backWallZ, w, h);
  const wallBL = worldToScreen(-HALL_HALF, FLOOR_Y, backWallZ, w, h);
  const wallBR = worldToScreen(HALL_HALF, FLOOR_Y, backWallZ, w, h);
  if (wallTL && wallTR && wallBL && wallBR) {
    const wallGrad = ctx.createLinearGradient(wallTL.sx, wallTL.sy, wallBR.sx, wallBR.sy);
    wallGrad.addColorStop(0, "#f2eadf");
    wallGrad.addColorStop(0.45, "#e8dcc8");
    wallGrad.addColorStop(1, "#d8ccb4");
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.moveTo(wallTL.sx, wallTL.sy);
    ctx.lineTo(wallTR.sx, wallTR.sy);
    ctx.lineTo(wallBR.sx, wallBR.sy);
    ctx.lineTo(wallBL.sx, wallBL.sy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(249, 158, 26, 0.9)";
    const stripeY = worldToScreen(0, 180, backWallZ, w, h);
    const stripeL = worldToScreen(-HALL_HALF * 0.85, 180, backWallZ, w, h);
    const stripeR = worldToScreen(HALL_HALF * 0.85, 180, backWallZ, w, h);
    if (stripeY && stripeL && stripeR) {
      ctx.fillRect(stripeL.sx, stripeY.sy - 4, stripeR.sx - stripeL.sx, 8);
    }

    ctx.strokeStyle = "rgba(78, 186, 191, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      wallTL.sx + 8,
      wallTL.sy + 8,
      wallTR.sx - wallTL.sx - 16,
      wallBL.sy - wallTL.sy - 16
    );
  }

  const sideL = worldToScreen(-HALL_HALF, 360, -80, w, h);
  const sideR = worldToScreen(HALL_HALF, 360, -80, w, h);
  if (sideL && sideR && wallTL) {
    ctx.fillStyle = "#e2d6c4";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(sideL.sx, sideL.sy);
    ctx.lineTo(wallTL.sx, wallTL.sy);
    ctx.lineTo(wallBL.sx, wallBL.sy);
    ctx.lineTo(sideL.sx, sideL.sy);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, horizon);
    ctx.lineTo(sideR.sx, sideR.sy);
    ctx.lineTo(wallTR.sx, wallTR.sy);
    ctx.lineTo(wallBR.sx, wallBR.sy);
    ctx.lineTo(sideR.sx, sideR.sy);
    ctx.closePath();
    ctx.fill();
  }

  drawPlatformWing(ctx, w, h, "left");
  drawPlatformWing(ctx, w, h, "right");

  ctx.strokeStyle = "rgba(110, 100, 88, 0.2)";
  ctx.lineWidth = 2;
  for (const laneX of [-360, 0, 360]) {
    const a = worldToScreen(laneX, FLOOR_Y, -120, w, h);
    const b = worldToScreen(laneX, FLOOR_Y, backWallZ, w, h);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(110, 100, 88, 0.16)";
  ctx.lineWidth = 1;
  for (let d = 0; d <= 14; d += 1) {
    const z = -180 - d * 220;
    const p1 = worldToScreen(-HALL_HALF, FLOOR_Y, z, w, h);
    const p2 = worldToScreen(HALL_HALF, FLOOR_Y, z, w, h);
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
  }

  for (const row of RANGE_ROWS) {
    const label = worldToScreen(-HALL_HALF + 24, FLOOR_Y + 4, row.z, w, h);
    if (!label) continue;
    ctx.fillStyle = "rgba(20, 22, 28, 0.55)";
    ctx.font = `600 ${Math.max(10, 12 * label.scale)}px var(--font, sans-serif)`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(row.label, label.sx, label.sy + 2);
  }

  const playerFoot = worldToScreen(testState.posX, FLOOR_Y, testState.posZ + 50, w, h);
  if (playerFoot && testState.running) {
    ctx.fillStyle = "rgba(78, 186, 191, 0.22)";
    ctx.beginPath();
    ctx.ellipse(playerFoot.sx, playerFoot.sy, 32, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTargetPad(ctx, t, w, h) {
  const base = worldToScreen(t.x, FLOOR_Y, t.z, w, h);
  if (!base) return;
  const padW = Math.max(28, 52 * base.scale);
  ctx.fillStyle = "#f99e1a";
  ctx.fillRect(base.sx - padW / 2, base.sy - 6, padW, 10);
  ctx.fillStyle = "rgba(60, 58, 55, 0.35)";
  ctx.fillRect(base.sx - padW * 0.15, base.sy - 4, padW * 0.3, 16);
}

function drawHumanTarget(ctx, t, w, h) {
  if (t.type === "wall") {
    drawWallTarget(ctx, t, w, h);
    return;
  }
  if (t.hit && t.hitFlash <= 0 && t.respawnAt && performance.now() >= t.respawnAt) return;
  if (t.hit && t.respawnAt && performance.now() < t.respawnAt) return;

  const bodyP = worldToScreen(t.x, t.y, t.z, w, h);
  if (!bodyP || bodyP.sx < -160 || bodyP.sx > w + 160 || bodyP.sy < -160 || bodyP.sy > h + 160) return;

  const sc = bodyP.scale;
  const bodyW = Math.max(18, target.bodyW * sc);
  const bodyH = Math.max(36, target.bodyH * sc);
  const headR = Math.max(10, target.headR * sc);
  const shoulderW = bodyW * 1.35;
  const cx = bodyP.sx;
  const footY = bodyP.sy + bodyH * 0.42;
  const bodyTop = footY - bodyH;
  const headCy = bodyTop - headR * 0.85;

  drawTargetPad(ctx, t, w, h);

  ctx.save();
  ctx.globalAlpha = t.hit ? Math.max(0.25, t.hitFlash * 0.7) : 1;

  ctx.fillStyle = "#dfe3ea";
  ctx.strokeStyle = "#3a3f48";
  ctx.lineWidth = Math.max(1.5, 2.2 * sc);

  ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH * 0.72);
  ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH * 0.72);

  ctx.fillRect(cx - shoulderW / 2, bodyTop + bodyH * 0.08, shoulderW, bodyH * 0.18);
  ctx.strokeRect(cx - shoulderW / 2, bodyTop + bodyH * 0.08, shoulderW, bodyH * 0.18);

  ctx.fillRect(cx - bodyW * 0.22, footY - bodyH * 0.08, bodyW * 0.18, bodyH * 0.38);
  ctx.fillRect(cx + bodyW * 0.04, footY - bodyH * 0.08, bodyW * 0.18, bodyH * 0.38);

  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f99e1a";
  ctx.fillRect(cx - bodyW * 0.28, bodyTop + bodyH * 0.2, bodyW * 0.56, bodyH * 0.16);

  ctx.fillStyle = "#4ebabf";
  ctx.fillRect(cx - headR * 0.55, headCy - headR * 0.15, headR * 1.1, headR * 0.35);

  if (t.hit && t.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${t.hitFlash * 0.55})`;
    ctx.beginPath();
    ctx.arc(cx, headCy, headR * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBotDummy(ctx, t, w, h) {
  drawHumanTarget(ctx, t, w, h);
}

function drawWallTarget(ctx, t, w, h) {
  const p = worldToScreen(t.x, t.y, t.z, w, h);
  if (!p) return;
  const r = Math.max(12, t.r * p.scale);
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(249, 158, 26, 0.22)";
  ctx.fill();
  ctx.strokeStyle = "#f99e1a";
  ctx.lineWidth = Math.max(2, 3 * p.scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "#f99e1a";
  ctx.fill();
  ctx.restore();
}

function drawTarget3D(ctx, t, w, h) {
  drawBotDummy(ctx, t, w, h);
}

function drawImpacts(ctx, w, h) {
  for (const imp of testState.impacts) {
    const p = worldToScreen(imp.x, imp.y, imp.z, w, h);
    if (!p || p.sx < -20 || p.sx > w + 20 || p.sy < -20 || p.sy > h + 20) continue;
    const r = Math.max(2.5, 5 * p.scale);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = imp.hit ? "rgba(249, 158, 26, 0.95)" : "rgba(180, 170, 155, 0.5)";
    ctx.fill();
  }
}

function drawFallbackCrosshair(ctx, cx, cy, arm) {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 4;
  ctx.globalCompositeOperation = "destination-over";
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

function drawCrosshairOverlay(ctx, w, h) {
  if (!testState.running) return;
  const code = testState.crosshairCode || DEFAULT_CROSSHAIR;
  const chSize = Math.max(48, Math.round(Math.min(w, h) * 0.12));
  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  try {
    if (typeof drawCrosshair === "function") {
      ctx.translate(cx - chSize / 2, cy - chSize / 2);
      drawCrosshair(ctx, code, chSize);
    } else {
      drawFallbackCrosshair(ctx, cx, cy, chSize * 0.22);
    }
  } catch {
    drawFallbackCrosshair(ctx, cx, cy, chSize * 0.22);
  }
  ctx.restore();
}

function drawWeaponView(ctx, w, h) {
  if (!testState.locked || !testState.running) return;
  const gunW = w * 0.22;
  const gunH = h * 0.18;
  const gx = w / 2 - gunW * 0.35;
  const gy = h - gunH * 0.55;
  ctx.save();
  ctx.fillStyle = "rgba(30, 28, 26, 0.75)";
  ctx.beginPath();
  ctx.moveTo(gx, gy + gunH);
  ctx.lineTo(gx + gunW * 0.35, gy);
  ctx.lineTo(gx + gunW, gy + gunH * 0.35);
  ctx.lineTo(gx + gunW * 0.55, gy + gunH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(60, 58, 55, 0.6)";
  ctx.fillRect(gx + gunW * 0.15, gy + gunH * 0.55, gunW * 0.65, gunH * 0.35);
  ctx.restore();
}

function drawTargetDistanceHud(ctx, w, h) {
  if (!testState.running || !testState.locked || testState.mode === "spray") return;
  const bot = getCurrentHumanTarget();
  if (!bot) return;

  ctx.fillStyle = "rgba(12, 14, 18, 0.65)";
  ctx.fillRect(w - 92, 10, 82, 36);
  ctx.fillStyle = "#f99e1a";
  ctx.fillRect(w - 92, 10, 3, 36);
  ctx.fillStyle = "#9aa3b2";
  ctx.font = "500 9px var(--font, sans-serif)";
  ctx.textAlign = "left";
  ctx.fillText("거리", w - 82, 22);
  ctx.fillStyle = "#fff";
  ctx.font = "700 18px var(--font, sans-serif)";
  ctx.fillText(bot.distLabel, w - 82, 38);

  if (isPlayerMoving()) {
    ctx.fillStyle = "rgba(220, 60, 60, 0.75)";
    ctx.fillRect(w - 92, 50, 82, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "600 9px var(--font, sans-serif)";
    ctx.fillText("이동 중 · 분산↑", w - 82, 62);
  }
}

function drawMovementHud(ctx, w, h) {
  if (!testState.locked || !testState.running) return;
  const keys = [
    { label: "W", on: testState.keys.forward, x: 72, y: h - 92 },
    { label: "A", on: testState.keys.left, x: 52, y: h - 72 },
    { label: "S", on: testState.keys.back, x: 72, y: h - 52 },
    { label: "D", on: testState.keys.right, x: 92, y: h - 72 },
  ];
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(40, h - 104, 72, 72);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.strokeRect(40, h - 104, 72, 72);
  ctx.font = "600 11px var(--font, sans-serif)";
  ctx.textAlign = "center";
  for (const k of keys) {
    ctx.fillStyle = k.on ? "rgba(78, 186, 191, 0.95)" : "rgba(255,255,255,0.14)";
    ctx.fillRect(k.x - 11, k.y - 11, 22, 22);
    ctx.fillStyle = k.on ? "#fff" : "#b8c0cc";
    ctx.fillText(k.label, k.x, k.y + 4);
  }
}

function drawHud(ctx, w, h) {
  if (testState.running && testState.mode === "reaction") {
    ctx.fillStyle = "rgba(244,245,247,0.95)";
    ctx.font = "600 18px var(--font, sans-serif)";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.ceil(testState.timeLeft)}s`, w - 20, 32);
  }

  if (testState.running && !testState.locked) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f4f5f7";
    ctx.font = "600 17px var(--font, sans-serif)";
    ctx.textAlign = "center";
    ctx.fillText("사격장을 클릭하여 FPS 모드 진입", w / 2, h / 2 - 10);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "400 13px var(--font, sans-serif)";
    ctx.fillText("클릭 후 WASD 이동 · 마우스 조준 · 좌클릭 발사", w / 2, h / 2 + 18);
  } else if (!testState.running && !testState.finished) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f4f5f7";
    ctx.font = "600 16px var(--font, sans-serif)";
    ctx.textAlign = "center";
    ctx.fillText("위에서 설정 후 시작 버튼을 누르세요", w / 2, h / 2 - 8);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "400 13px var(--font, sans-serif)";
    ctx.fillText("훈련장 · 이동하며 사격 연습", w / 2, h / 2 + 18);
  }

  if (testState.locked && testState.mode === "practice") {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(w - 148, 12, 136, 28);
    ctx.fillStyle = "#4ebabf";
    ctx.font = "600 12px var(--font, sans-serif)";
    ctx.textAlign = "right";
    ctx.fillText("훈련장 · 자유 연습", w - 16, 31);
  }

  if (testState.locked) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(8, h - 36, 108, 24);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "500 11px var(--font, sans-serif)";
    ctx.textAlign = "left";
    ctx.fillText("ESC · 종료", 16, h - 19);
  }
}

function renderFrame() {
  const canvas = testEls.canvas;
  if (!canvas) return;
  let { w, h, dpr } = getViewSize();
  if (w < 10 || h < 10) {
    resizeCanvas();
    ({ w, h, dpr } = getViewSize());
    if (w < 10 || h < 10) return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(testState.shakeX, testState.shakeY);
  drawFpsScene(ctx, w, h);

  const drawList = [];
  if (testState.mode === "spray" && testState.centerTarget) {
    drawList.push(testState.centerTarget);
  } else {
    for (const t of testState.rangeTargets) drawList.push(t);
  }
  drawList.sort((a, b) => b.z - a.z);
  for (const t of drawList) drawBotDummy(ctx, t, w, h);

  drawImpacts(ctx, w, h);
  ctx.restore();
  drawCrosshairOverlay(ctx, w, h);
  drawWeaponView(ctx, w, h);
  drawMovementHud(ctx, w, h);
  drawTargetDistanceHud(ctx, w, h);
  drawHud(ctx, w, h);
}

function renderLoop(now) {
  try {
    const t = now || performance.now();
    const dt = Math.min(0.05, (t - lastFrameTime) / 1000);
    lastFrameTime = t;
    updateRecoilRecovery(dt);
    updateScreenShake(dt);
    updatePlayerMovement(dt);
    updateRangeTargets(dt);
    renderFrame();
  } catch (err) {
    console.error("Aimlock render error:", err);
  }
  requestAnimationFrame(renderLoop);
}

let lastFrameTime = performance.now();

function updateStatsUI() {
  if (!testEls.statHits) return;
  testEls.statHits.textContent = String(testState.hits);
  testEls.statShots.textContent = String(testState.shots);
  testEls.statAccuracy.textContent = formatPct(accuracyPct());
  testEls.statReaction.textContent = formatMs(avgReactionTime());

  const best = loadBestRecord(testState.mode, testState.weapon);
  if (testEls.statBest) {
    if (!best) {
      testEls.statBest.textContent = "—";
    } else if (testState.mode === "reaction") {
      testEls.statBest.textContent = `${best.hits}명중 · ${formatMs(best.avgReaction)}`;
    } else if (testState.mode === "accuracy") {
      testEls.statBest.textContent = `${formatPct(best.accuracy)} · ${formatMs(best.timeMs)}`;
    } else if (testState.mode === "practice") {
      testEls.statBest.textContent = `${best.hits}명중 · ${formatPct(best.accuracy)}`;
    } else {
      testEls.statBest.textContent = `${formatPct(best.accuracy)} · ${best.spreadPx}px`;
    }
  }

  if (testEls.statExtra && testEls.statExtraRow) {
    if (testState.mode === "accuracy" && testState.running) {
      testEls.statExtraRow.hidden = false;
      testEls.statExtraLabel.textContent = "남은 표적";
      testEls.statExtra.textContent = String(testState.targetsRemaining);
    } else if (testState.mode === "reaction" && testState.running && !testState.finished) {
      testEls.statExtraRow.hidden = false;
      testEls.statExtraLabel.textContent = "남은 시간";
      testEls.statExtra.textContent = `${Math.ceil(testState.timeLeft)}s`;
    } else if (testState.mode === "spray" && testState.impacts.length) {
      testEls.statExtraRow.hidden = false;
      testEls.statExtraLabel.textContent = "탄착군 분포";
      testEls.statExtra.textContent = `±${calcSpreadRadius().toFixed(0)}px`;
    } else if (testState.mode === "practice" && testState.running) {
      testEls.statExtraRow.hidden = false;
      const bot = getCurrentHumanTarget();
      testEls.statExtraLabel.textContent = "표적 거리";
      testEls.statExtra.textContent = bot ? bot.distLabel : "—";
    } else {
      testEls.statExtraRow.hidden = true;
    }
  }
}

function calcSpreadRadius() {
  const { w, h } = getViewSize();
  let maxD = 0;
  for (const imp of testState.impacts) {
    const p = worldToScreen(imp.x, imp.y, imp.z, w, h);
    if (p) maxD = Math.max(maxD, Math.hypot(p.sx - w / 2, p.sy - h / 2));
  }
  return maxD;
}

function evaluateBestRecord() {
  const prev = loadBestRecord(testState.mode, testState.weapon);
  let record = null;
  let isNewBest = false;

  if (testState.mode === "reaction") {
    if (testState.hits <= 0) return { isNewBest: false };
    const avg = avgReactionTime();
    record = { hits: testState.hits, avgReaction: avg, at: Date.now() };
    isNewBest =
      !prev ||
      testState.hits > prev.hits ||
      (testState.hits === prev.hits && avg > 0 && avg < prev.avgReaction);
  } else if (testState.mode === "accuracy") {
    if (testState.shots <= 0) return { isNewBest: false };
    const acc = accuracyPct();
    record = { accuracy: acc, timeMs: testState.elapsedMs, hits: testState.hits, at: Date.now() };
    isNewBest =
      !prev ||
      acc > prev.accuracy ||
      (acc === prev.accuracy && testState.elapsedMs < prev.timeMs);
  } else if (testState.mode === "practice") {
    return { isNewBest: false };
  } else {
    if (testState.shots <= 0) return { isNewBest: false };
    const acc = accuracyPct();
    const spread = calcSpreadRadius();
    record = { accuracy: acc, spreadPx: spread, shots: testState.shots, at: Date.now() };
    isNewBest =
      !prev ||
      acc > prev.accuracy ||
      (acc === prev.accuracy && spread < prev.spreadPx);
  }

  if (isNewBest && record) saveBestRecord(testState.mode, testState.weapon, record);
  return { isNewBest, record, prev };
}

function showResultOverlay() {
  const { isNewBest } = evaluateBestRecord();
  updateStatsUI();
  exitPointerLock();

  const overlay = testEls.resultOverlay;
  if (!overlay) return;

  let title = "테스트 완료";
  const lines = [];

  if (testState.mode === "reaction") {
    title = "반응속도 테스트 결과";
    lines.push(`명중: ${testState.hits}회`, `발사: ${testState.shots}발`, `평균 반응속도: ${formatMs(avgReactionTime())}`, `명중률: ${formatPct(accuracyPct())}`);
  } else if (testState.mode === "accuracy") {
    title = "정확도 테스트 결과";
    lines.push(`명중률: ${formatPct(accuracyPct())}`, `소요 시간: ${formatMs(testState.elapsedMs)}`, `명중: ${testState.hits} / ${testState.targetsTotal}`, `발사: ${testState.shots}발`);
  } else {
    title = "연사 테스트 결과";
    lines.push(`명중률: ${formatPct(accuracyPct())}`, `탄착군 분포: ±${calcSpreadRadius().toFixed(0)}px`, `발사: ${testState.shots}발`, `명중: ${testState.hits}발`);
  }

  testEls.resultTitle.textContent = title;
  testEls.resultBody.innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
  const showBadge = isNewBest && (testState.hits > 0 || testState.shots > 0);
  setOverlayVisible(overlay, true);
  if (testEls.resultBadge) {
    testEls.resultBadge.hidden = !showBadge;
    testEls.resultBadge.style.display = showBadge ? "inline-block" : "none";
  }
}

function setOverlayVisible(overlay, visible) {
  if (!overlay) return;
  overlay.hidden = !visible;
  overlay.style.display = visible ? "flex" : "none";
  overlay.classList.toggle("is-open", visible);
}

function hideResultOverlay() {
  setOverlayVisible(testEls.resultOverlay, false);
  testState.finished = false;
}

function exitPointerLock() {
  testState.locked = false;
  if (testEls.canvas) testEls.canvas.classList.remove("is-locked");
  if (document.pointerLockElement === testEls.canvas) document.exitPointerLock();
}

function clearTestSession() {
  stopAutoFire();
  exitPointerLock();
  if (testState.timerId) {
    clearInterval(testState.timerId);
    testState.timerId = null;
  }
  resetWeaponSpray();
  testState.running = false;
  testState.finished = false;
  testState.zoomed = false;
  testState.yaw = 0;
  testState.pitch = 0;
  resetRecoil();
  testState.posX = 0;
  testState.posZ = 0;
  testState.bobOffset = 0;
  testState.bobPhase = 0;
  clearMovementKeys();
  testState.velX = 0;
  testState.velZ = 0;
  testState.hits = 0;
  testState.shots = 0;
  testState.reactionTimes = [];
  testState.targets = [];
  testState.rangeTargets = [];
  testState.impacts = [];
  testState.centerTarget = null;
  testState.activeTargetId = null;
  testState.elapsedMs = 0;
  testState.timeLeft = 30;
  testState.holdingFire = false;
  hideResultOverlay();
}

function finishTest() {
  testState.running = false;
  testState.finished = true;
  stopAutoFire();
  exitPointerLock();
  if (testState.timerId) {
    clearInterval(testState.timerId);
    testState.timerId = null;
  }
  showResultOverlay();
  updateStatsUI();
}

function startTest() {
  clearTestSession();
  setOverlayVisible(testEls.resultOverlay, false);
  resizeCanvas();
  testState.running = true;
  testState.crosshairCode = loadActiveCrosshair();
  syncCrosshairUI();

  const startedAt = performance.now();
  initRangeSession();

  if (testState.mode === "reaction") {
    testState.timeLeft = 30;
    testState.timerId = setInterval(() => {
      testState.timeLeft -= 1;
      updateStatsUI();
      if (testState.timeLeft <= 0) {
        testState.elapsedMs = performance.now() - startedAt;
        finishTest();
      }
    }, 1000);
  } else if (testState.mode === "accuracy") {
    testState.targetsTotal = 50;
    testState.targetsRemaining = 50;
    testState.timerId = setInterval(() => {
      testState.elapsedMs = performance.now() - startedAt;
      updateStatsUI();
    }, 100);
  }

  updateStatsUI();
  showTestToast(`${MODES[testState.mode].label} 시작 — 사격장을 클릭하세요`);
}

function restartTest() {
  startTest();
}

function stopTest() {
  if (!testState.running) return;
  stopAutoFire();
  exitPointerLock();
  if (testState.timerId) {
    clearInterval(testState.timerId);
    testState.timerId = null;
  }
  testState.running = false;
  testState.finished = false;
  testState.holdingFire = false;
  testState.zoomed = false;
  clearMovementKeys();
  resetRecoil();
  updateStatsUI();
  showTestToast("테스트를 종료했습니다. 설정을 변경할 수 있습니다.");
}

function syncCrosshairUI() {
  try {
    if (testEls.crosshairPreview && typeof crosshairPreviewDataUrl === "function") {
      testEls.crosshairPreview.src = crosshairPreviewDataUrl(testState.crosshairCode, "crosshair", 80);
    }
  } catch {
    /* preview 실패해도 사격장은 동작 */
  }
  if (testEls.crosshairCodeInput) {
    testEls.crosshairCodeInput.value = testState.crosshairCode;
  }
}

function bindWeaponModeSelectors() {
  if (!testEls.weaponGroup || !testEls.modeGroup) return;

  testEls.weaponGroup.innerHTML = "";
  Object.entries(WEAPONS).forEach(([key, w]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "test-option" + (testState.weapon === key ? " is-active" : "");
    btn.title = w.desc;
    btn.innerHTML = `<span class="test-option-label">${w.label}</span><span class="test-option-desc">${w.desc}</span>`;
    btn.addEventListener("click", () => {
      if (!canChangeSettings()) {
        showTestToast("FPS 모드 중에는 설정을 변경할 수 없습니다.");
        return;
      }
      testState.weapon = key;
      bindWeaponModeSelectors();
      updateStatsUI();
    });
    testEls.weaponGroup.appendChild(btn);
  });

  testEls.modeGroup.innerHTML = "";
  Object.entries(MODES).forEach(([key, m]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "test-option" + (testState.mode === key ? " is-active" : "");
    btn.title = m.desc;
    btn.innerHTML = `<span class="test-option-label">${m.label}</span><span class="test-option-desc">${m.desc}</span>`;
    btn.addEventListener("click", () => {
      if (!canChangeSettings()) {
        showTestToast("FPS 모드 중에는 설정을 변경할 수 없습니다.");
        return;
      }
      testState.mode = key;
      bindWeaponModeSelectors();
      updateStatsUI();
    });
    testEls.modeGroup.appendChild(btn);
  });
}

function requestFpsLock() {
  if (!testState.running || testState.finished || !testEls.canvas) return;
  testEls.canvas.requestPointerLock();
}

function bindSensitivityControls() {
  if (!testEls.sensSlider) return;

  testEls.sensSlider.addEventListener("input", () => {
    if (!canChangeSettings()) {
      syncSensitivityUI();
      showTestToast("FPS 모드 중에는 감도를 변경할 수 없습니다.");
      return;
    }
    setSensitivity(Number(testEls.sensSlider.value));
  });
}

function bindMovementKeys() {
  const setKey = (code, down) => {
    if (code === "KeyA") testState.keys.left = down;
    if (code === "KeyD") testState.keys.right = down;
    if (code === "KeyW") testState.keys.forward = down;
    if (code === "KeyS") testState.keys.back = down;
  };

  document.addEventListener("keydown", (e) => {
    if (!testState.running || !testState.locked) return;
    if (!["KeyA", "KeyD", "KeyW", "KeyS"].includes(e.code)) return;
    e.preventDefault();
    setKey(e.code, true);
  });

  document.addEventListener("keyup", (e) => {
    setKey(e.code, false);
  });
}

function bindCanvasEvents() {
  const canvas = testEls.canvas;
  if (!canvas) return;

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("click", () => {
    if (testState.running && !testState.finished && document.pointerLockElement !== canvas) {
      requestFpsLock();
    }
  });

  document.addEventListener("pointerlockchange", () => {
    testState.locked = document.pointerLockElement === canvas;
    canvas.classList.toggle("is-locked", testState.locked);
  });

  document.addEventListener("mousemove", (e) => {
    if (!testState.locked || !testState.running) return;
    const sens = getMouseSensitivity();
    testState.yaw += e.movementX * sens;
    testState.pitch = clamp(testState.pitch + e.movementY * sens, -1.1, 1.1);
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      if (testState.weapon === "operator" && testState.running) {
        testState.zoomed = true;
      }
      return;
    }
    if (e.button !== 0) return;
    if (!testState.running || testState.finished) return;
    if (document.pointerLockElement !== canvas) {
      requestFpsLock();
      return;
    }
    testState.holdingFire = true;
    fireBullet();
    if (WEAPONS[testState.weapon].auto) startAutoFire();
  });

  const stopFire = () => {
    testState.holdingFire = false;
    stopAutoFire();
  };

  canvas.addEventListener("mouseup", (e) => {
    if (e.button === 2 && testState.weapon === "operator") testState.zoomed = false;
    if (e.button === 0) stopFire();
  });

  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) stopFire();
    if (e.button === 2 && testState.weapon === "operator") testState.zoomed = false;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!testState.running || testState.finished) return;
    if (testState.locked) exitPointerLock();
    stopTest();
  });
}

function initTestPage() {
  testEls.view = document.getElementById("viewTest");
  testEls.rangeWrap = document.getElementById("testRangeWrap");
  testEls.canvas = document.getElementById("testCanvas");
  testEls.weaponGroup = document.getElementById("testWeaponGroup");
  testEls.modeGroup = document.getElementById("testModeGroup");
  testEls.startBtn = document.getElementById("testStartBtn");
  testEls.restartBtn = document.getElementById("testRestartBtn");
  testEls.stopBtn = document.getElementById("testStopBtn");
  testEls.sensSlider = document.getElementById("testSensSlider");
  testEls.sensValue = document.getElementById("testSensValue");
  testEls.statHits = document.getElementById("statHits");
  testEls.statShots = document.getElementById("statShots");
  testEls.statAccuracy = document.getElementById("statAccuracy");
  testEls.statReaction = document.getElementById("statReaction");
  testEls.statBest = document.getElementById("statBest");
  testEls.statExtraRow = document.getElementById("statExtraRow");
  testEls.statExtraLabel = document.getElementById("statExtraLabel");
  testEls.statExtra = document.getElementById("statExtra");
  testEls.crosshairPreview = document.getElementById("testCrosshairPreview");
  testEls.crosshairCodeInput = document.getElementById("testCrosshairCode");
  testEls.crosshairApplyBtn = document.getElementById("testCrosshairApply");
  testEls.resultOverlay = document.getElementById("testResultOverlay");
  testEls.resultTitle = document.getElementById("testResultTitle");
  testEls.resultBody = document.getElementById("testResultBody");
  testEls.resultBadge = document.getElementById("testResultBadge");
  testEls.resultCloseBtn = document.getElementById("testResultClose");

  if (!testEls.view || !testEls.canvas) return;

  clearTestSession();
  setOverlayVisible(testEls.resultOverlay, false);
  testState.crosshairCode = loadActiveCrosshair();
  testState.sensitivity = loadSensitivity();
  bindWeaponModeSelectors();
  bindSensitivityControls();
  bindMovementKeys();
  bindCanvasEvents();
  resizeCanvas();
  updateStatsUI();
  syncSensitivityUI();
  try {
    syncCrosshairUI();
  } catch {
    /* ignore */
  }

  testEls.startBtn?.addEventListener("click", startTest);
  testEls.restartBtn?.addEventListener("click", restartTest);
  testEls.stopBtn?.addEventListener("click", stopTest);
  testEls.resultCloseBtn?.addEventListener("click", () => {
    hideResultOverlay();
    if (!testState.running) updateStatsUI();
  });

  testEls.crosshairApplyBtn?.addEventListener("click", () => {
    const code = testEls.crosshairCodeInput.value.trim();
    if (!code) return;
    testState.crosshairCode = code;
    saveActiveCrosshair(code);
    syncCrosshairUI();
    showTestToast("조준점이 적용되었습니다.");
  });

  testEls.crosshairCodeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") testEls.crosshairApplyBtn?.click();
  });

  window.addEventListener("aimlock:crosshair-change", (e) => {
    if (e.detail?.code) {
      testState.crosshairCode = e.detail.code;
      syncCrosshairUI();
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === ACTIVE_CROSSHAIR_KEY && e.newValue) {
      testState.crosshairCode = e.newValue;
      syncCrosshairUI();
    }
  });

  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(() => {
    resizeCanvas();
  });
  renderLoop();
}

window.setActiveCrosshair = function setActiveCrosshair(code) {
  testState.crosshairCode = code;
  saveActiveCrosshair(code);
  syncCrosshairUI();
};

document.addEventListener("DOMContentLoaded", initTestPage);
