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

const WEAPONS = {
  vandal: {
    label: "Vandal",
    desc: "연사 · 첫 탄 정확 · 연사 시 탄착군 증가",
    auto: true,
    resetMs: 500,
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
    spread: [{ min: 1, max: Infinity, rMin: 0, rMax: 0 }],
    fireInterval: 400,
  },
  operator: {
    label: "Operator",
    desc: "저격총 · 우클릭 줌",
    auto: false,
    resetMs: 0,
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
  crosshairCode: DEFAULT_CROSSHAIR,
  zoomed: false,
  shotCount: 0,
  lastShotAt: 0,
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
  rafId: null,
  targets: [],
  impacts: [],
  centerTarget: null,
};

const testEls = {};

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
  const sum = testState.reactionTimes.reduce((a, b) => a + b, 0);
  return sum / testState.reactionTimes.length;
}

function accuracyPct() {
  if (!testState.shots) return 0;
  return (testState.hits / testState.shots) * 100;
}

function spawnRandomTarget(padding = 60) {
  const canvas = testEls.canvas;
  if (!canvas) return null;
  const w = canvas.width;
  const h = canvas.height;
  const cx = padding + Math.random() * (w - padding * 2);
  const cy = padding + Math.random() * (h - padding * 2);
  return { x: cx, y: cy, r: 22, hit: false };
}

function spawnCenterTarget() {
  const canvas = testEls.canvas;
  if (!canvas) return null;
  return { x: canvas.width / 2, y: canvas.height / 2, r: 48, hit: false };
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
    testState.resetTimer = null;
  }, weapon.resetMs);
}

function canFireNow() {
  const weapon = WEAPONS[testState.weapon];
  const now = performance.now();
  return now - testState.lastFireAt >= weapon.fireInterval;
}

function fireBullet() {
  if (!testState.running || testState.finished) return;
  if (!canFireNow()) return;

  const canvas = testEls.canvas;
  if (!canvas) return;

  const weapon = WEAPONS[testState.weapon];
  const now = performance.now();
  testState.lastFireAt = now;
  testState.shotCount += 1;
  testState.shots += 1;
  scheduleSprayReset();

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const spread = getSpreadRadius(testState.weapon, testState.shotCount, testState.zoomed);
  const angle = Math.random() * Math.PI * 2;
  const dist = spread * Math.random();
  const bx = cx + Math.cos(angle) * dist;
  const by = cy + Math.sin(angle) * dist;

  let hit = false;

  if (testState.mode === "spray" && testState.centerTarget) {
    const t = testState.centerTarget;
    const dx = bx - t.x;
    const dy = by - t.y;
    if (Math.hypot(dx, dy) <= t.r) {
      hit = true;
      testState.hits += 1;
    }
    testState.impacts.push({ x: bx, y: by, hit, at: now });
  } else {
    for (const t of testState.targets) {
      if (t.hit) continue;
      const dx = bx - t.x;
      const dy = by - t.y;
      if (Math.hypot(dx, dy) <= t.r) {
        t.hit = true;
        hit = true;
        testState.hits += 1;
        if (testState.mode === "reaction" && testState.targetSpawnAt) {
          testState.reactionTimes.push(now - testState.targetSpawnAt);
          spawnNextReactionTarget();
        } else if (testState.mode === "accuracy") {
          testState.targetsRemaining -= 1;
          if (testState.targetsRemaining <= 0) {
            finishTest();
          } else {
            testState.targets.push(spawnRandomTarget());
          }
        }
        break;
      }
    }
  }

  updateStatsUI();
  renderFrame();
}

function spawnNextReactionTarget() {
  testState.targets = [spawnRandomTarget()];
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
  const h = Math.max(280, Math.floor(rect.height));
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawRangeBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#2a3144");
  grad.addColorStop(0.5, "#1e2433");
  grad.addColorStop(1, "#151820");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = 0; x < w; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 70, 85, 0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);
}

function drawTarget(ctx, t) {
  if (t.hit && testState.mode !== "spray") return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 70, 85, 0.25)";
  ctx.fill();
  ctx.strokeStyle = "#ff4655";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = "#ff4655";
  ctx.fill();
  ctx.restore();
}

function drawImpacts(ctx) {
  for (const imp of testState.impacts) {
    ctx.beginPath();
    ctx.arc(imp.x, imp.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = imp.hit ? "rgba(59, 130, 246, 0.9)" : "rgba(255, 255, 255, 0.35)";
    ctx.fill();
  }
}

function drawCrosshairOverlay(ctx, w, h) {
  const size = Math.min(w, h);
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  if (!octx || typeof drawCrosshair !== "function") return;
  drawCrosshair(octx, testState.crosshairCode, size);
  ctx.drawImage(off, (w - size) / 2, (h - size) / 2, size, size);
}

function drawZoomOverlay(ctx, w, h) {
  if (!testState.zoomed) return;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(0, 0, w, h);
  const scopeR = Math.min(w, h) * 0.28;
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, scopeR, 0, Math.PI * 2);
  ctx.clip();
  ctx.clearRect(0, 0, w, h);
  drawRangeBackground(ctx, w, h);
  if (testState.mode === "spray" && testState.centerTarget) {
    drawTarget(ctx, testState.centerTarget);
  }
  testState.targets.forEach((t) => drawTarget(ctx, t));
  drawImpacts(ctx);
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, scopeR, 0, Math.PI * 2);
  ctx.stroke();
}

function renderFrame() {
  const canvas = testEls.canvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, w, h);
  drawRangeBackground(ctx, w, h);

  if (testState.mode === "spray" && testState.centerTarget) {
    drawTarget(ctx, testState.centerTarget);
  }
  testState.targets.forEach((t) => drawTarget(ctx, t));
  drawImpacts(ctx);

  if (testState.weapon === "operator" && testState.zoomed) {
    drawZoomOverlay(ctx, w, h);
  }

  drawCrosshairOverlay(ctx, w, h);

  if (testState.running && testState.mode === "reaction") {
    ctx.fillStyle = "rgba(244, 245, 247, 0.9)";
    ctx.font = "600 18px var(--font, sans-serif)";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.ceil(testState.timeLeft)}s`, w - 24, 36);
  }

  if (!testState.running && !testState.finished) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f4f5f7";
    ctx.font = "600 16px var(--font, sans-serif)";
    ctx.textAlign = "center";
    ctx.fillText("시작 버튼을 눌러 테스트를 시작하세요", w / 2, h / 2 - 8);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "400 13px var(--font, sans-serif)";
    ctx.fillText("좌클릭: 발사 · Operator는 우클릭 줌", w / 2, h / 2 + 18);
  }
}

function renderLoop() {
  renderFrame();
  testState.rafId = requestAnimationFrame(renderLoop);
}

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
    } else if (testState.mode === "reaction" && testState.running) {
      testEls.statExtraRow.hidden = false;
      testEls.statExtraLabel.textContent = "남은 시간";
      testEls.statExtra.textContent = `${Math.ceil(testState.timeLeft)}s`;
    } else if (testState.mode === "spray" && testState.impacts.length) {
      testEls.statExtraRow.hidden = false;
      testEls.statExtraLabel.textContent = "탄착군 분포";
      const spread = calcSpreadRadius();
      testEls.statExtra.textContent = `±${spread.toFixed(0)}px`;
    } else {
      testEls.statExtraRow.hidden = true;
    }
  }
}

function calcSpreadRadius() {
  const canvas = testEls.canvas;
  if (!canvas || !testState.impacts.length) return 0;
  const cx = canvas.width / (window.devicePixelRatio || 1) / 2;
  const cy = canvas.height / (window.devicePixelRatio || 1) / 2;
  let maxD = 0;
  for (const imp of testState.impacts) {
    maxD = Math.max(maxD, Math.hypot(imp.x - cx, imp.y - cy));
  }
  return maxD;
}

function evaluateBestRecord() {
  const prev = loadBestRecord(testState.mode, testState.weapon);
  let record = null;
  let isNewBest = false;

  if (testState.mode === "reaction") {
    const avg = avgReactionTime();
    record = { hits: testState.hits, avgReaction: avg, at: Date.now() };
    isNewBest =
      !prev ||
      testState.hits > prev.hits ||
      (testState.hits === prev.hits && avg > 0 && avg < prev.avgReaction);
  } else if (testState.mode === "accuracy") {
    const acc = accuracyPct();
    record = { accuracy: acc, timeMs: testState.elapsedMs, hits: testState.hits, at: Date.now() };
    isNewBest =
      !prev ||
      acc > prev.accuracy ||
      (acc === prev.accuracy && testState.elapsedMs < prev.timeMs);
  } else {
    const acc = accuracyPct();
    const spread = calcSpreadRadius();
    record = { accuracy: acc, spreadPx: spread, shots: testState.shots, at: Date.now() };
    isNewBest =
      !prev ||
      acc > prev.accuracy ||
      (acc === prev.accuracy && spread < prev.spreadPx);
  }

  if (isNewBest) {
    saveBestRecord(testState.mode, testState.weapon, record);
  }
  return { record, isNewBest, prev };
}

function showResultOverlay() {
  const { isNewBest } = evaluateBestRecord();
  updateStatsUI();

  const overlay = testEls.resultOverlay;
  if (!overlay) return;

  let title = "테스트 완료";
  let lines = [];

  if (testState.mode === "reaction") {
    title = "반응속도 테스트 결과";
    lines = [
      `명중: ${testState.hits}회`,
      `발사: ${testState.shots}발`,
      `평균 반응속도: ${formatMs(avgReactionTime())}`,
      `명중률: ${formatPct(accuracyPct())}`,
    ];
  } else if (testState.mode === "accuracy") {
    title = "정확도 테스트 결과";
    lines = [
      `명중률: ${formatPct(accuracyPct())}`,
      `소요 시간: ${formatMs(testState.elapsedMs)}`,
      `명중: ${testState.hits} / ${testState.targetsTotal}`,
      `발사: ${testState.shots}발`,
    ];
  } else {
    title = "연사 테스트 결과";
    lines = [
      `명중률: ${formatPct(accuracyPct())}`,
      `탄착군 분포: ±${calcSpreadRadius().toFixed(0)}px`,
      `발사: ${testState.shots}발`,
      `명중: ${testState.hits}발`,
    ];
  }

  testEls.resultTitle.textContent = title;
  testEls.resultBody.innerHTML = lines.map((l) => `<p>${l}</p>`).join("");
  testEls.resultBadge.hidden = !isNewBest;
  overlay.hidden = false;
}

function hideResultOverlay() {
  if (testEls.resultOverlay) testEls.resultOverlay.hidden = true;
}

function clearTestSession() {
  stopAutoFire();
  if (testState.timerId) {
    clearInterval(testState.timerId);
    testState.timerId = null;
  }
  resetWeaponSpray();
  testState.running = false;
  testState.finished = false;
  testState.zoomed = false;
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
  if (testState.timerId) {
    clearInterval(testState.timerId);
    testState.timerId = null;
  }
  showResultOverlay();
  updateStatsUI();
}

function startTest() {
  clearTestSession();
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
    testState.targets = [spawnRandomTarget()];
    testState.timerId = setInterval(() => {
      testState.elapsedMs = performance.now() - startedAt;
      updateStatsUI();
    }, 100);
  } else {
    testState.centerTarget = spawnCenterTarget();
    testState.impacts = [];
  }

  updateStatsUI();
  showTestToast(`${MODES[testState.mode].label} 시작!`);
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
  testEls.weaponGroup.innerHTML = "";
  Object.entries(WEAPONS).forEach(([key, w]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "test-option" + (testState.weapon === key ? " is-active" : "");
    btn.innerHTML = `<span class="test-option-label">${w.label}</span><span class="test-option-desc">${w.desc}</span>`;
    btn.addEventListener("click", () => {
      if (testState.running) return;
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
      if (testState.running) return;
      testState.mode = key;
      bindWeaponModeSelectors();
      updateStatsUI();
    });
    testEls.modeGroup.appendChild(btn);
  });
}

function bindCanvasEvents() {
  const canvas = testEls.canvas;
  if (!canvas) return;

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
      if (testState.weapon === "operator") {
        testState.zoomed = true;
        renderFrame();
      }
      return;
    }
    if (e.button !== 0) return;
    testState.holdingFire = true;
    if (testState.running) {
      fireBullet();
      if (WEAPONS[testState.weapon].auto) startAutoFire();
    }
  });

  const stopFire = () => {
    testState.holdingFire = false;
    stopAutoFire();
  };

  canvas.addEventListener("mouseup", (e) => {
    if (e.button === 2 && testState.weapon === "operator") {
      testState.zoomed = false;
      renderFrame();
    }
    if (e.button === 0) stopFire();
  });

  canvas.addEventListener("mouseleave", () => {
    testState.holdingFire = false;
    testState.zoomed = false;
    stopAutoFire();
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

  if (!testEls.view) return;

  testState.crosshairCode = loadActiveCrosshair();
  syncCrosshairUI();
  bindWeaponModeSelectors();
  bindCanvasEvents();
  updateStatsUI();

  testEls.startBtn.addEventListener("click", startTest);
  testEls.restartBtn.addEventListener("click", restartTest);
  testEls.resultCloseBtn.addEventListener("click", hideResultOverlay);

  testEls.crosshairApplyBtn.addEventListener("click", () => {
    const code = testEls.crosshairCodeInput.value.trim();
    if (!code) return;
    testState.crosshairCode = code;
    saveActiveCrosshair(code);
    syncCrosshairUI();
    showTestToast("조준점이 적용되었습니다.");
  });

  testEls.crosshairCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") testEls.crosshairApplyBtn.click();
  });

  window.addEventListener("aimlock:crosshair-change", (e) => {
    if (e.detail && e.detail.code) {
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

  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  renderLoop();
}

function onTestViewShow() {
  testState.crosshairCode = loadActiveCrosshair();
  syncCrosshairUI();
  updateStatsUI();
  resizeCanvas();
}

window.setActiveCrosshair = function setActiveCrosshair(code) {
  testState.crosshairCode = code;
  saveActiveCrosshair(code);
  syncCrosshairUI();
};

window.initTestPage = initTestPage;
window.onTestViewShow = onTestViewShow;

document.addEventListener("DOMContentLoaded", initTestPage);
