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
const BEST_RECORD_PREFIX = "aimlock_test_best_";
const DEFAULT_CROSSHAIR =
  "0;P;c;5;o;1;d;1;0b;0;1b;0;S;c;5;o;1;d;1;0b;0;1b;0;";

const WALL_Z = -1400;

const WEAPONS = {
  vandal: {
    label: "Vandal",
    desc: "연사 · 첫 탄 정확 · 연사 시 탄착군 증가",
    auto: true,
    resetMs: 500,
    recoilUp: 0.0065,
    recoilSide: 0.0022,
    maxRecoil: 0.32,
    recovery: 9,
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
    desc: "Vandal보다 안정적인 연사",
    auto: true,
    resetMs: 400,
    recoilUp: 0.0048,
    recoilSide: 0.0016,
    maxRecoil: 0.26,
    recovery: 11,
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
    desc: "단발 권총 · 항상 정확",
    auto: false,
    resetMs: 0,
    recoilUp: 0.011,
    recoilSide: 0.0008,
    maxRecoil: 0.14,
    recovery: 14,
    spread: [{ min: 1, max: Infinity, rMin: 0, rMax: 0 }],
    fireInterval: 400,
  },
  operator: {
    label: "Operator",
    desc: "저격총 · 우클릭 줌",
    auto: false,
    resetMs: 0,
    recoilUp: 0.016,
    recoilSide: 0.0012,
    maxRecoil: 0.2,
    recovery: 7,
    spread: [{ min: 1, max: Infinity, rMin: 20, rMax: 20 }],
    zoomSpread: [{ min: 1, max: Infinity, rMin: 0, rMax: 0 }],
    fireInterval: 1200,
  },
};

const MODES = {
  reaction: {
    label: "반응속도 테스트",
    desc: "30초 동안 랜덤 표적을 빠르게 제거하세요.",
  },
  accuracy: {
    label: "정확도 테스트",
    desc: "50개의 표적을 모두 제거하세요.",
  },
  spray: {
    label: "연사 테스트",
    desc: "중앙 표적에 연사하여 탄착군을 확인하세요.",
  },
};

const testState = {
  weapon: "vandal",
  mode: "reaction",
  running: false,
  finished: false,
  locked: false,
  crosshairCode: DEFAULT_CROSSHAIR,
  zoomed: false,
  yaw: 0,
  pitch: 0,
  recoilPitch: 0,
  recoilYaw: 0,
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
  if (testState.weapon === "operator" && testState.zoomed) return (28 * Math.PI) / 180;
  return (72 * Math.PI) / 180;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function getSpreadRadius(weaponKey, shotCount, zoomed) {
  const w = WEAPONS[weaponKey];
  const rules = weaponKey === "operator" && zoomed ? w.zoomSpread : w.spread;
  for (const rule of rules) {
    if (shotCount >= rule.min && shotCount <= rule.max) {
      if (rule.rMin === rule.rMax) return rule.rMin;
      return rule.rMin + Math.random() * (rule.rMax - rule.rMin);
    }
  }
  return 0;
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

function applyRecoilKick() {
  const cfg = WEAPONS[testState.weapon];
  const ramp = 1 + Math.min(testState.shotCount, 12) * 0.035;
  testState.recoilPitch += cfg.recoilUp * ramp;
  testState.recoilYaw += (Math.random() - 0.5) * cfg.recoilSide * 2;
  const maxR = cfg.maxRecoil || 0.3;
  testState.recoilPitch = Math.min(testState.recoilPitch, maxR);
  testState.recoilYaw = clamp(testState.recoilYaw, -maxR * 0.45, maxR * 0.45);
}

function queueRecoilKick() {
  requestAnimationFrame(() => {
    if (testState.running && !testState.finished) applyRecoilKick();
  });
}

function updateRecoilRecovery(dt) {
  if (!testState.running || testState.finished) return;
  const cfg = WEAPONS[testState.weapon];
  const rate = testState.holdingFire ? cfg.recovery * 0.4 : cfg.recovery;
  const factor = Math.exp(-rate * dt);
  testState.recoilPitch *= factor;
  testState.recoilYaw *= factor;
  if (Math.abs(testState.recoilPitch) < 0.00004) testState.recoilPitch = 0;
  if (Math.abs(testState.recoilYaw) < 0.00004) testState.recoilYaw = 0;
}

function resetRecoil() {
  testState.recoilPitch = 0;
  testState.recoilYaw = 0;
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
  const { forward, right, up } = getCameraBasis();
  const depth = wx * forward.x + wy * forward.y + wz * forward.z;
  if (depth <= 20) return null;
  const rx = wx * right.x + wy * right.y + wz * right.z;
  const ry = wx * up.x + wy * up.y + wz * up.z;
  const scale = getProjectionScale(viewH);
  return {
    sx: viewW / 2 + (rx / depth) * scale,
    sy: viewH / 2 - (ry / depth) * scale,
    scale: scale / depth,
    depth,
  };
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
  const ray = getCrosshairRay(spreadPx, viewW, viewH);
  return { dx: ray.x, dy: ray.y, dz: ray.z };
}

function rayHitSphere(ray, target) {
  return rayHitSphereDetailed(ray, target).hit;
}

function rayHitSphereDetailed(ray, target) {
  const ocX = -target.x;
  const ocY = -target.y;
  const ocZ = -target.z;
  const b = 2 * (ocX * ray.dx + ocY * ray.dy + ocZ * ray.dz);
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - target.r * target.r;
  const disc = b * b - 4 * c;
  if (disc < 0) return { hit: false };
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t <= 0) return { hit: false };
  return { hit: true, t, x: ray.dx * t, y: ray.dy * t, z: ray.dz * t };
}

function rayWallHit(ray, wallZ = WALL_Z) {
  if (ray.dz >= -0.0001) return null;
  const t = wallZ / ray.dz;
  if (t <= 0) return null;
  return { x: ray.dx * t, y: ray.dy * t, z: wallZ };
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

  const checkList =
    testState.mode === "spray" && testState.centerTarget
      ? [testState.centerTarget]
      : testState.targets.filter((t) => !t.hit);

  for (const t of checkList) {
    const hitInfo = rayHitSphereDetailed(ray, t);
    if (hitInfo.hit) {
      hit = true;
      impactPoint = { x: hitInfo.x, y: hitInfo.y, z: hitInfo.z };
      if (testState.mode !== "spray") t.hit = true;
      testState.hits += 1;

      if (testState.mode === "reaction") {
        testState.reactionTimes.push(now - testState.targetSpawnAt);
        spawnNextReactionTarget();
      } else if (testState.mode === "accuracy") {
        testState.targetsRemaining -= 1;
        if (testState.targetsRemaining <= 0) finishTest();
        else testState.targets.push(spawnWallTarget(false));
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

  queueRecoilKick();
  updateStatsUI();
}

function spawnNextReactionTarget() {
  testState.targets = [spawnWallTarget(false)];
  testState.targetSpawnAt = performance.now();
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
  const w = Math.max(320, Math.floor(rect.width));
  const h = Math.max(320, Math.floor(rect.height));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFpsScene(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, "#1a2030");
  sky.addColorStop(1, "#2a3348");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const floorY = h * 0.58;
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, "#3d4658");
  floor.addColorStop(1, "#151820");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(w, floorY);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  const vanish = worldToScreen(0, -120, -1400, w, h);
  const vx = vanish ? vanish.sx : w / 2;
  const vy = vanish ? vanish.sy : floorY;

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i += 1) {
    const left = worldToScreen(i * 180, -200, -1400, w, h);
    const right = worldToScreen(i * 180, -200, -200, w, h);
    if (!left || !right) continue;
    ctx.beginPath();
    ctx.moveTo(left.sx, left.sy);
    ctx.lineTo(right.sx, right.sy);
    ctx.stroke();
  }
  for (let d = 0; d <= 8; d += 1) {
    const z = -200 - d * 150;
    const p1 = worldToScreen(-900, -200, z, w, h);
    const p2 = worldToScreen(900, -200, z, w, h);
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
  }

  const wallTL = worldToScreen(-950, 320, -1400, w, h);
  const wallTR = worldToScreen(950, 320, -1400, w, h);
  const wallBL = worldToScreen(-950, -280, -1400, w, h);
  const wallBR = worldToScreen(950, -280, -1400, w, h);
  if (wallTL && wallTR && wallBL && wallBR) {
    ctx.fillStyle = "#252b3a";
    ctx.beginPath();
    ctx.moveTo(wallTL.sx, wallTL.sy);
    ctx.lineTo(wallTR.sx, wallTR.sy);
    ctx.lineTo(wallBR.sx, wallBR.sy);
    ctx.lineTo(wallBL.sx, wallBL.sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,70,85,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.beginPath();
  ctx.moveTo(0, vy);
  ctx.lineTo(w, vy);
  ctx.stroke();
}

function drawTarget3D(ctx, t, w, h) {
  if (t.hit && testState.mode !== "spray") return;
  const p = worldToScreen(t.x, t.y, t.z, w, h);
  if (!p || p.sx < -80 || p.sx > w + 80 || p.sy < -80 || p.sy > h + 80) return;
  const r = Math.max(8, t.r * p.scale);

  ctx.save();
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 70, 85, 0.3)";
  ctx.fill();
  ctx.strokeStyle = "#ff4655";
  ctx.lineWidth = Math.max(1.5, 2 * p.scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "#ff4655";
  ctx.fill();
  ctx.restore();
}

function drawImpacts(ctx, w, h) {
  for (const imp of testState.impacts) {
    const p = worldToScreen(imp.x, imp.y, imp.z, w, h);
    if (!p || p.sx < -20 || p.sx > w + 20 || p.sy < -20 || p.sy > h + 20) continue;
    const r = Math.max(2.5, 5 * p.scale);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = imp.hit ? "rgba(59, 130, 246, 0.95)" : "rgba(255,255,255,0.45)";
    ctx.fill();
  }
}

function drawCrosshairOverlay(ctx, w, h) {
  if (typeof drawCrosshair !== "function") return;
  const size = Math.min(w, h) * 0.18;
  const off = document.createElement("canvas");
  off.width = 256;
  off.height = 256;
  const octx = off.getContext("2d");
  if (!octx) return;
  drawCrosshair(octx, testState.crosshairCode, 256);
  ctx.drawImage(off, (w - size) / 2, (h - size) / 2, size, size);
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
    ctx.fillText("마우스로 시점 회전 · 좌클릭 발사 · ESC 종료", w / 2, h / 2 + 18);
  } else if (!testState.running && !testState.finished) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f4f5f7";
    ctx.font = "600 16px var(--font, sans-serif)";
    ctx.textAlign = "center";
    ctx.fillText("좌측에서 설정 후 시작 버튼을 누르세요", w / 2, h / 2 - 8);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "400 13px var(--font, sans-serif)";
    ctx.fillText("1인칭 시점 · 조준점 테스트", w / 2, h / 2 + 18);
  }

  if (testState.locked) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(8, h - 36, 130, 24);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "500 11px var(--font, sans-serif)";
    ctx.textAlign = "left";
    ctx.fillText("ESC · FPS 모드 해제", 16, h - 19);
  }
}

function renderFrame() {
  const canvas = testEls.canvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w, h } = getViewSize();

  ctx.clearRect(0, 0, w, h);
  drawFpsScene(ctx, w, h);

  if (testState.mode === "spray" && testState.centerTarget) {
    drawTarget3D(ctx, testState.centerTarget, w, h);
  }
  testState.targets.forEach((t) => drawTarget3D(ctx, t, w, h));
  drawImpacts(ctx, w, h);
  drawCrosshairOverlay(ctx, w, h);
  drawHud(ctx, w, h);
}

function renderLoop(now) {
  const t = now || performance.now();
  const dt = Math.min(0.05, (t - lastFrameTime) / 1000);
  lastFrameTime = t;
  updateRecoilRecovery(dt);
  renderFrame();
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
    } else {
      testEls.statBest.textContent = `${formatPct(best.accuracy)} · ${best.spreadPx}px`;
    }
  }

  if (testEls.statExtra) {
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
  testState.hits = 0;
  testState.shots = 0;
  testState.reactionTimes = [];
  testState.targets = [];
  testState.impacts = [];
  testState.centerTarget = null;
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

  if (testState.mode === "reaction") {
    testState.timeLeft = 30;
    spawnNextReactionTarget();
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
    testState.targets = [spawnWallTarget(false)];
    testState.timerId = setInterval(() => {
      testState.elapsedMs = performance.now() - startedAt;
      updateStatsUI();
    }, 100);
  } else {
    testState.centerTarget = spawnWallTarget(true);
    testState.impacts = [];
  }

  updateStatsUI();
  showTestToast(`${MODES[testState.mode].label} 시작 — 사격장을 클릭하세요`);
}

function restartTest() {
  startTest();
}

function syncCrosshairUI() {
  if (testEls.crosshairPreview && typeof crosshairPreviewDataUrl === "function") {
    testEls.crosshairPreview.src = crosshairPreviewDataUrl(testState.crosshairCode, "crosshair", 80);
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
    btn.innerHTML = `<span class="test-option-label">${w.label}</span><span class="test-option-desc">${w.desc}</span>`;
    btn.addEventListener("click", () => {
      if (testState.running) {
        showTestToast("테스트 중에는 설정을 변경할 수 없습니다.");
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
    btn.innerHTML = `<span class="test-option-label">${m.label}</span><span class="test-option-desc">${m.desc}</span>`;
    btn.addEventListener("click", () => {
      if (testState.running) {
        showTestToast("테스트 중에는 설정을 변경할 수 없습니다.");
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
    testState.yaw += e.movementX * 0.0022;
    testState.pitch = clamp(testState.pitch + e.movementY * 0.0022, -1.1, 1.1);
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
    if (e.key === "Escape" && testState.locked) exitPointerLock();
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
  syncCrosshairUI();
  bindWeaponModeSelectors();
  bindCanvasEvents();
  updateStatsUI();
  resizeCanvas();

  testEls.startBtn?.addEventListener("click", startTest);
  testEls.restartBtn?.addEventListener("click", restartTest);
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
  renderLoop();
}

window.setActiveCrosshair = function setActiveCrosshair(code) {
  testState.crosshairCode = code;
  saveActiveCrosshair(code);
  syncCrosshairUI();
};

document.addEventListener("DOMContentLoaded", initTestPage);
