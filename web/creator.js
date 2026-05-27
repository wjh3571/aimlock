(function () {
  "use strict";

  /* ================================================
     Constants
     ================================================ */

  const PRESETS_STORAGE_KEY = "aimlock_crosshair_presets";

  const VALORANT_COLORS = [
    { name: "흰색",   hex: "#ffffff" },
    { name: "초록",   hex: "#00ff00" },
    { name: "연두",   hex: "#7fff00" },
    { name: "라임",   hex: "#dfff00" },
    { name: "노랑",   hex: "#ffff00" },
    { name: "시안",   hex: "#00ffff" },
    { name: "마젠타", hex: "#ff00ff" },
    { name: "빨강",   hex: "#ff0000" },
  ];

  const PRO_PRESETS = [
    {
      name: "TenZ",
      state: {
        color: "#00ffff",
        outlineOn: false, outlineOpacity: 0.5, outlineThickness: 1,
        centerDot: { on: false, size: 2, opacity: 1 },
        innerLines: { on: true, length: 4, thickness: 2, offset: 2, opacity: 1 },
        outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
        movementError: 0, firingError: 0,
      },
    },
    {
      name: "yay",
      state: {
        color: "#00ffff",
        outlineOn: true, outlineOpacity: 1, outlineThickness: 1,
        centerDot: { on: true, size: 3, opacity: 1 },
        innerLines: { on: false, length: 6, thickness: 2, offset: 3, opacity: 1 },
        outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
        movementError: 0, firingError: 0,
      },
    },
    {
      name: "aspas",
      state: {
        color: "#00ff00",
        outlineOn: false, outlineOpacity: 0.5, outlineThickness: 1,
        centerDot: { on: false, size: 2, opacity: 1 },
        innerLines: { on: true, length: 3, thickness: 2, offset: 2, opacity: 1 },
        outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
        movementError: 0, firingError: 0,
      },
    },
    {
      name: "Demon1",
      state: {
        color: "#00ff00",
        outlineOn: false, outlineOpacity: 0.5, outlineThickness: 1,
        centerDot: { on: false, size: 2, opacity: 1 },
        innerLines: { on: true, length: 4, thickness: 2, offset: 0, opacity: 1 },
        outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
        movementError: 0, firingError: 0,
      },
    },
    {
      name: "Shroud",
      state: {
        color: "#00ffff",
        outlineOn: true, outlineOpacity: 0.5, outlineThickness: 1,
        centerDot: { on: true, size: 2, opacity: 1 },
        innerLines: { on: true, length: 4, thickness: 2, offset: 3, opacity: 1 },
        outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
        movementError: 0, firingError: 0,
      },
    },
    {
      name: "ScreaM",
      state: {
        color: "#00ff00",
        outlineOn: true, outlineOpacity: 0.5, outlineThickness: 1,
        centerDot: { on: true, size: 3, opacity: 1 },
        innerLines: { on: true, length: 5, thickness: 2, offset: 2, opacity: 1 },
        outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
        movementError: 0, firingError: 0,
      },
    },
  ];

  const DEFAULT_STATE = {
    color: "#ffffff",
    outlineOn: true, outlineOpacity: 0.5, outlineThickness: 1,
    centerDot: { on: true, size: 2, opacity: 1 },
    innerLines: { on: true, length: 6, thickness: 2, offset: 3, opacity: 1 },
    outerLines: { on: false, length: 2, thickness: 2, offset: 10, opacity: 1 },
    movementError: 0, firingError: 0,
  };

  /* ================================================
     State
     ================================================ */

  let state = deepClone(DEFAULT_STATE);
  let simMovement = false;
  let simFiring = false;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ================================================
     DOM References
     ================================================ */

  const $ = (id) => document.getElementById(id);

  const els = {
    colorPicker:        $("colorPicker"),
    colorSwatches:      $("colorSwatches"),
    outlineOn:          $("outlineOn"),
    outlineThickness:   $("outlineThickness"),
    outlineThicknessVal:$("outlineThicknessVal"),
    outlineOpacity:     $("outlineOpacity"),
    outlineOpacityVal:  $("outlineOpacityVal"),
    dotOn:              $("dotOn"),
    dotSize:            $("dotSize"),
    dotSizeVal:         $("dotSizeVal"),
    dotOpacity:         $("dotOpacity"),
    dotOpacityVal:      $("dotOpacityVal"),
    innerOn:            $("innerOn"),
    innerLength:        $("innerLength"),
    innerLengthVal:     $("innerLengthVal"),
    innerThickness:     $("innerThickness"),
    innerThicknessVal:  $("innerThicknessVal"),
    innerOffset:        $("innerOffset"),
    innerOffsetVal:     $("innerOffsetVal"),
    innerOpacity:       $("innerOpacity"),
    innerOpacityVal:    $("innerOpacityVal"),
    outerOn:            $("outerOn"),
    outerLength:        $("outerLength"),
    outerLengthVal:     $("outerLengthVal"),
    outerThickness:     $("outerThickness"),
    outerThicknessVal:  $("outerThicknessVal"),
    outerOffset:        $("outerOffset"),
    outerOffsetVal:     $("outerOffsetVal"),
    outerOpacity:       $("outerOpacity"),
    outerOpacityVal:    $("outerOpacityVal"),
    movementError:      $("movementError"),
    movementErrorVal:   $("movementErrorVal"),
    firingError:        $("firingError"),
    firingErrorVal:     $("firingErrorVal"),
    chContainer:        $("chContainer"),
    simMovementBtn:     $("simMovement"),
    simFiringBtn:       $("simFiring"),
    codeImport:         $("codeImport"),
    codeImportBtn:      $("codeImportBtn"),
    codeOutput:         $("codeOutput"),
    codeCopyBtn:        $("codeCopyBtn"),
    resetBtn:           $("resetBtn"),
    randomBtn:          $("randomBtn"),
    savePresetBtn:      $("savePresetBtn"),
    proPresets:         $("proPresets"),
    userPresets:        $("userPresets"),
    userPresetsEmpty:   $("userPresetsEmpty"),
    toast:              $("toast"),
  };

  /* ================================================
     Crosshair Rendering (div-based)
     ================================================ */

  const chElements = {};

  function initCrosshairElements() {
    const container = els.chContainer;

    const parts = [
      "ol-inner-top", "ol-inner-bottom", "ol-inner-left", "ol-inner-right",
      "ol-outer-top", "ol-outer-bottom", "ol-outer-left", "ol-outer-right",
      "ol-dot",
      "inner-top", "inner-bottom", "inner-left", "inner-right",
      "outer-top", "outer-bottom", "outer-left", "outer-right",
      "dot",
    ];

    parts.forEach((key) => {
      const el = document.createElement("div");
      el.className = "cr-ch-el";
      container.appendChild(el);
      chElements[key] = el;
    });
  }

  function renderCrosshair() {
    const container = els.chContainer;
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (!w || !h) return;

    const cx = w / 2;
    const cy = h / 2;

    const lenPx  = (v) => Math.round((v * Math.min(w, h)) / 52);
    const thkPx  = (v) => Math.max(1, Math.round((v * Math.min(w, h)) / 96));
    const olPx   = (v) => Math.max(1, Math.round((v * Math.min(w, h)) / 120));

    const dynMove = simMovement ? state.movementError : 0;
    const dynFire = simFiring ? state.firingError : 0;
    const dynExtra = dynMove + dynFire;

    const innerExtra = lenPx(dynExtra);
    const outerExtra = lenPx(dynExtra);

    const ol = {
      on: state.outlineOn,
      size: olPx(state.outlineThickness),
      opacity: state.outlineOpacity,
    };

    hideAll();

    if (state.innerLines.on) {
      const len  = lenPx(state.innerLines.length);
      const thk  = thkPx(state.innerLines.thickness);
      const off  = lenPx(state.innerLines.offset) + innerExtra;
      const color = state.color;
      const alpha = state.innerLines.opacity;

      applyLine(chElements["inner-left"],   cx - off - len, cy - thk / 2, len, thk, color, alpha);
      applyLine(chElements["inner-right"],  cx + off,       cy - thk / 2, len, thk, color, alpha);
      applyLine(chElements["inner-top"],    cx - thk / 2,   cy - off - len, thk, len, color, alpha);
      applyLine(chElements["inner-bottom"], cx - thk / 2,   cy + off,       thk, len, color, alpha);

      if (ol.on) {
        applyLine(chElements["ol-inner-left"],   cx - off - len - ol.size, cy - thk / 2 - ol.size, len + ol.size * 2, thk + ol.size * 2, "#000", ol.opacity);
        applyLine(chElements["ol-inner-right"],  cx + off - ol.size,       cy - thk / 2 - ol.size, len + ol.size * 2, thk + ol.size * 2, "#000", ol.opacity);
        applyLine(chElements["ol-inner-top"],    cx - thk / 2 - ol.size,   cy - off - len - ol.size, thk + ol.size * 2, len + ol.size * 2, "#000", ol.opacity);
        applyLine(chElements["ol-inner-bottom"], cx - thk / 2 - ol.size,   cy + off - ol.size,       thk + ol.size * 2, len + ol.size * 2, "#000", ol.opacity);
      }
    }

    if (state.outerLines.on) {
      const len  = lenPx(state.outerLines.length);
      const thk  = thkPx(state.outerLines.thickness);
      const off  = lenPx(state.outerLines.offset) + outerExtra;
      const color = state.color;
      const alpha = state.outerLines.opacity;

      applyLine(chElements["outer-left"],   cx - off - len, cy - thk / 2, len, thk, color, alpha);
      applyLine(chElements["outer-right"],  cx + off,       cy - thk / 2, len, thk, color, alpha);
      applyLine(chElements["outer-top"],    cx - thk / 2,   cy - off - len, thk, len, color, alpha);
      applyLine(chElements["outer-bottom"], cx - thk / 2,   cy + off,       thk, len, color, alpha);

      if (ol.on) {
        applyLine(chElements["ol-outer-left"],   cx - off - len - ol.size, cy - thk / 2 - ol.size, len + ol.size * 2, thk + ol.size * 2, "#000", ol.opacity);
        applyLine(chElements["ol-outer-right"],  cx + off - ol.size,       cy - thk / 2 - ol.size, len + ol.size * 2, thk + ol.size * 2, "#000", ol.opacity);
        applyLine(chElements["ol-outer-top"],    cx - thk / 2 - ol.size,   cy - off - len - ol.size, thk + ol.size * 2, len + ol.size * 2, "#000", ol.opacity);
        applyLine(chElements["ol-outer-bottom"], cx - thk / 2 - ol.size,   cy + off - ol.size,       thk + ol.size * 2, len + ol.size * 2, "#000", ol.opacity);
      }
    }

    if (state.centerDot.on) {
      const dot = Math.max(1, thkPx((state.centerDot.size || 2) * 2));
      const x = cx - dot / 2;
      const y = cy - dot / 2;

      applyLine(chElements["dot"], x, y, dot, dot, state.color, state.centerDot.opacity);

      if (ol.on) {
        applyLine(chElements["ol-dot"], x - ol.size, y - ol.size, dot + ol.size * 2, dot + ol.size * 2, "#000", ol.opacity);
      }
    }
  }

  function applyLine(el, x, y, w, h, color, opacity) {
    const s = el.style;
    s.display = "block";
    s.left   = Math.round(x) + "px";
    s.top    = Math.round(y) + "px";
    s.width  = Math.round(w) + "px";
    s.height = Math.round(h) + "px";
    s.background = color;
    s.opacity = opacity;
  }

  function hideAll() {
    Object.values(chElements).forEach((el) => { el.style.display = "none"; });
  }

  /* ================================================
     Code Generation
     ================================================ */

  function colorToCodeParts(hex) {
    const lower = hex.toLowerCase();
    const idx = VALORANT_COLORS.findIndex((c) => c.hex === lower);
    if (idx >= 0) return ["c", String(idx)];
    const r = lower.slice(1, 3);
    const g = lower.slice(3, 5);
    const b = lower.slice(5, 7);
    return ["u", r + g + b + "FF"];
  }

  function generateCode() {
    const p = [];
    p.push("0", "P");
    p.push(...colorToCodeParts(state.color));
    p.push("h", state.outlineOn ? "1" : "0");
    if (state.outlineOn) {
      p.push("o", String(state.outlineOpacity));
      p.push("t", String(state.outlineThickness));
    }
    p.push("d", state.centerDot.on ? "1" : "0");
    if (state.centerDot.on) {
      p.push("z", String(state.centerDot.size));
      p.push("a", String(state.centerDot.opacity));
    }
    p.push("0b", state.innerLines.on ? "1" : "0");
    if (state.innerLines.on) {
      p.push("0l", String(state.innerLines.length));
      p.push("0t", String(state.innerLines.thickness));
      p.push("0o", String(state.innerLines.offset));
      p.push("0a", String(state.innerLines.opacity));
    }
    p.push("1b", state.outerLines.on ? "1" : "0");
    if (state.outerLines.on) {
      p.push("1l", String(state.outerLines.length));
      p.push("1t", String(state.outerLines.thickness));
      p.push("1o", String(state.outerLines.offset));
      p.push("1a", String(state.outerLines.opacity));
    }
    return p.join(";");
  }

  function updateCodeDisplay() {
    els.codeOutput.textContent = generateCode();
  }

  /* ================================================
     Code Parsing (Valorant format)
     ================================================ */

  function valorantColorFromIndex(idx) {
    return VALORANT_COLORS[idx] ? VALORANT_COLORS[idx].hex : "#ffffff";
  }

  function parseValorantCode(code) {
    const parts = String(code || "").split(";");
    const r = deepClone(DEFAULT_STATE);

    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const v = parts[i + 1];
      switch (k) {
        case "c":
          if (/^\d+$/.test(v)) r.color = valorantColorFromIndex(parseInt(v, 10));
          break;
        case "u":
          if (/^[0-9A-Fa-f]{6,8}$/.test(v)) r.color = "#" + v.slice(0, 6);
          break;
        case "h":  r.outlineOn = v === "1"; break;
        case "o":  r.outlineOpacity = clamp(parseFloat(v), 0, 1, 0.5); break;
        case "t":  r.outlineThickness = numVal(v, 1); break;
        case "d":  r.centerDot.on = v === "1"; break;
        case "z":  r.centerDot.size = numVal(v, 2); break;
        case "a":  r.centerDot.opacity = clamp(parseFloat(v), 0, 1, 1); break;
        case "0b": r.innerLines.on = v !== "0"; break;
        case "0l": r.innerLines.length = numVal(v, 6); break;
        case "0t": r.innerLines.thickness = numVal(v, 2); break;
        case "0o": r.innerLines.offset = numVal(v, 3); break;
        case "0a": r.innerLines.opacity = clamp(parseFloat(v), 0, 1, 1); break;
        case "1b": r.outerLines.on = v !== "0"; break;
        case "1l": r.outerLines.length = numVal(v, 2); break;
        case "1t": r.outerLines.thickness = numVal(v, 2); break;
        case "1o": r.outerLines.offset = numVal(v, 10); break;
        case "1a": r.outerLines.opacity = clamp(parseFloat(v), 0, 1, 1); break;
      }
    }
    return r;
  }

  function clamp(n, min, max, fallback) {
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function numVal(v, fallback) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /* ================================================
     State ↔ UI Synchronization
     ================================================ */

  function syncUIFromState() {
    els.colorPicker.value = state.color;
    syncSwatchHighlight();

    els.outlineOn.checked = state.outlineOn;
    els.outlineThickness.value = state.outlineThickness;
    els.outlineThicknessVal.textContent = state.outlineThickness;
    els.outlineOpacity.value = state.outlineOpacity;
    els.outlineOpacityVal.textContent = state.outlineOpacity.toFixed(2);

    els.dotOn.checked = state.centerDot.on;
    els.dotSize.value = state.centerDot.size;
    els.dotSizeVal.textContent = state.centerDot.size;
    els.dotOpacity.value = state.centerDot.opacity;
    els.dotOpacityVal.textContent = state.centerDot.opacity.toFixed(2);

    els.innerOn.checked = state.innerLines.on;
    els.innerLength.value = state.innerLines.length;
    els.innerLengthVal.textContent = state.innerLines.length;
    els.innerThickness.value = state.innerLines.thickness;
    els.innerThicknessVal.textContent = state.innerLines.thickness;
    els.innerOffset.value = state.innerLines.offset;
    els.innerOffsetVal.textContent = state.innerLines.offset;
    els.innerOpacity.value = state.innerLines.opacity;
    els.innerOpacityVal.textContent = state.innerLines.opacity.toFixed(2);

    els.outerOn.checked = state.outerLines.on;
    els.outerLength.value = state.outerLines.length;
    els.outerLengthVal.textContent = state.outerLines.length;
    els.outerThickness.value = state.outerLines.thickness;
    els.outerThicknessVal.textContent = state.outerLines.thickness;
    els.outerOffset.value = state.outerLines.offset;
    els.outerOffsetVal.textContent = state.outerLines.offset;
    els.outerOpacity.value = state.outerLines.opacity;
    els.outerOpacityVal.textContent = state.outerLines.opacity.toFixed(2);

    els.movementError.value = state.movementError;
    els.movementErrorVal.textContent = state.movementError.toFixed(1);
    els.firingError.value = state.firingError;
    els.firingErrorVal.textContent = state.firingError.toFixed(1);

    syncDependentSliders();
    updateCodeDisplay();
    renderCrosshair();
  }

  function syncDependentSliders() {
    toggleDependents("outlineOn", state.outlineOn);
    toggleDependents("dotOn", state.centerDot.on);
    toggleDependents("innerOn", state.innerLines.on);
    toggleDependents("outerOn", state.outerLines.on);
  }

  function toggleDependents(depKey, enabled) {
    document.querySelectorAll(`[data-depends="${depKey}"]`).forEach((el) => {
      el.classList.toggle("is-disabled", !enabled);
    });
  }

  function syncSwatchHighlight() {
    const lower = state.color.toLowerCase();
    document.querySelectorAll(".cr-swatch").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.color === lower);
    });
  }

  function onStateChange() {
    syncDependentSliders();
    updateCodeDisplay();
    renderCrosshair();
  }

  /* ================================================
     Preset Management
     ================================================ */

  function loadUserPresets() {
    try {
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveUserPresets(presets) {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }

  function generatePreviewDataUrl(presetState) {
    const size = 120;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, "#647086");
    bg.addColorStop(1, "#33394b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const s = presetState;
    const cxc = size / 2;
    const cyc = size / 2;
    const lenPx  = (v) => Math.round((v * size) / 52);
    const thkPx  = (v) => Math.max(1, Math.round((v * size) / 96));
    const olPxFn = (v) => Math.max(1, Math.round((v * size) / 120));

    function drawRect(x, y, w, h, color, alpha) {
      if (w <= 0 || h <= 0 || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      ctx.restore();
    }

    function drawBarSet(line) {
      if (!line.on) return;
      const len = lenPx(line.length);
      const thk = thkPx(line.thickness);
      const off = lenPx(line.offset);
      const olSz = s.outlineOn ? olPxFn(s.outlineThickness) : 0;

      const bars = [
        [cxc - off - len, cyc - thk / 2, len, thk],
        [cxc + off, cyc - thk / 2, len, thk],
        [cxc - thk / 2, cyc - off - len, thk, len],
        [cxc - thk / 2, cyc + off, thk, len],
      ];

      if (s.outlineOn) {
        bars.forEach(([x, y, w, h]) => {
          drawRect(x - olSz, y - olSz, w + olSz * 2, h + olSz * 2, "#000", s.outlineOpacity);
        });
      }
      bars.forEach(([x, y, w, h]) => {
        drawRect(x, y, w, h, s.color, line.opacity);
      });
    }

    drawBarSet(s.outerLines);
    drawBarSet(s.innerLines);

    if (s.centerDot.on) {
      const dot = Math.max(1, thkPx((s.centerDot.size || 2) * 2));
      const dx = cxc - dot / 2;
      const dy = cyc - dot / 2;
      if (s.outlineOn) {
        const olSz = olPxFn(s.outlineThickness);
        drawRect(dx - olSz, dy - olSz, dot + olSz * 2, dot + olSz * 2, "#000", s.outlineOpacity);
      }
      drawRect(dx, dy, dot, dot, s.color, s.centerDot.opacity);
    }

    return canvas.toDataURL("image/png");
  }

  function renderProPresets() {
    els.proPresets.innerHTML = "";
    PRO_PRESETS.forEach((preset) => {
      els.proPresets.appendChild(createPresetCard(preset, false));
    });
  }

  function renderUserPresets() {
    const presets = loadUserPresets();
    els.userPresets.innerHTML = "";

    if (presets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "cr-preset-empty";
      empty.textContent = "저장된 프리셋이 없습니다.";
      els.userPresets.appendChild(empty);
      return;
    }

    presets.forEach((preset, index) => {
      els.userPresets.appendChild(createPresetCard(preset, true, index));
    });
  }

  function createPresetCard(preset, deletable, index) {
    const card = document.createElement("div");
    card.className = "cr-preset-card";
    card.title = preset.name;

    const thumb = document.createElement("div");
    thumb.className = "cr-preset-thumb";
    const img = document.createElement("img");
    img.src = generatePreviewDataUrl(preset.state);
    img.alt = preset.name;
    thumb.appendChild(img);

    const name = document.createElement("div");
    name.className = "cr-preset-name";
    name.textContent = preset.name;

    card.appendChild(thumb);
    card.appendChild(name);

    card.addEventListener("click", (e) => {
      if (e.target.closest(".cr-preset-del")) return;
      state = deepClone(preset.state);
      syncUIFromState();
      showToast(`"${preset.name}" 프리셋을 적용했습니다.`);
    });

    if (deletable) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cr-preset-del";
      del.title = "삭제";
      del.innerHTML = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        const presets = loadUserPresets();
        presets.splice(index, 1);
        saveUserPresets(presets);
        renderUserPresets();
        showToast("프리셋을 삭제했습니다.");
      });
      card.appendChild(del);
    }

    return card;
  }

  /* ================================================
     Random Crosshair
     ================================================ */

  function randomCrosshair() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randFloat = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

    state.color = pick(VALORANT_COLORS).hex;
    state.outlineOn = Math.random() > 0.4;
    state.outlineThickness = randInt(1, 2);
    state.outlineOpacity = randFloat(0.3, 1);
    state.centerDot.on = Math.random() > 0.5;
    state.centerDot.size = randInt(1, 5);
    state.centerDot.opacity = randFloat(0.7, 1);
    state.innerLines.on = Math.random() > 0.2;
    state.innerLines.length = randInt(2, 10);
    state.innerLines.thickness = randInt(1, 4);
    state.innerLines.offset = randInt(0, 8);
    state.innerLines.opacity = randFloat(0.6, 1);
    state.outerLines.on = Math.random() > 0.6;
    state.outerLines.length = randInt(1, 6);
    state.outerLines.thickness = randInt(1, 3);
    state.outerLines.offset = randInt(5, 20);
    state.outerLines.opacity = randFloat(0.5, 1);
    state.movementError = 0;
    state.firingError = 0;
  }

  /* ================================================
     Toast
     ================================================ */

  let toastTimer;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2200);
  }

  /* ================================================
     Event Binding
     ================================================ */

  function bindEvents() {
    /* --- Color --- */
    els.colorPicker.addEventListener("input", () => {
      state.color = els.colorPicker.value;
      syncSwatchHighlight();
      onStateChange();
    });

    /* --- Toggles --- */
    els.outlineOn.addEventListener("change", () => {
      state.outlineOn = els.outlineOn.checked;
      onStateChange();
    });
    els.dotOn.addEventListener("change", () => {
      state.centerDot.on = els.dotOn.checked;
      onStateChange();
    });
    els.innerOn.addEventListener("change", () => {
      state.innerLines.on = els.innerOn.checked;
      onStateChange();
    });
    els.outerOn.addEventListener("change", () => {
      state.outerLines.on = els.outerOn.checked;
      onStateChange();
    });

    /* --- Sliders --- */
    const bindSlider = (el, valEl, getter, setter, fmt) => {
      el.addEventListener("input", () => {
        const v = parseFloat(el.value);
        setter(v);
        valEl.textContent = fmt ? fmt(v) : String(v);
        onStateChange();
      });
    };

    bindSlider(els.outlineThickness, els.outlineThicknessVal,
      () => state.outlineThickness, (v) => { state.outlineThickness = v; });
    bindSlider(els.outlineOpacity, els.outlineOpacityVal,
      () => state.outlineOpacity, (v) => { state.outlineOpacity = v; }, (v) => v.toFixed(2));

    bindSlider(els.dotSize, els.dotSizeVal,
      () => state.centerDot.size, (v) => { state.centerDot.size = v; });
    bindSlider(els.dotOpacity, els.dotOpacityVal,
      () => state.centerDot.opacity, (v) => { state.centerDot.opacity = v; }, (v) => v.toFixed(2));

    bindSlider(els.innerLength, els.innerLengthVal,
      () => state.innerLines.length, (v) => { state.innerLines.length = v; });
    bindSlider(els.innerThickness, els.innerThicknessVal,
      () => state.innerLines.thickness, (v) => { state.innerLines.thickness = v; });
    bindSlider(els.innerOffset, els.innerOffsetVal,
      () => state.innerLines.offset, (v) => { state.innerLines.offset = v; });
    bindSlider(els.innerOpacity, els.innerOpacityVal,
      () => state.innerLines.opacity, (v) => { state.innerLines.opacity = v; }, (v) => v.toFixed(2));

    bindSlider(els.outerLength, els.outerLengthVal,
      () => state.outerLines.length, (v) => { state.outerLines.length = v; });
    bindSlider(els.outerThickness, els.outerThicknessVal,
      () => state.outerLines.thickness, (v) => { state.outerLines.thickness = v; });
    bindSlider(els.outerOffset, els.outerOffsetVal,
      () => state.outerLines.offset, (v) => { state.outerLines.offset = v; });
    bindSlider(els.outerOpacity, els.outerOpacityVal,
      () => state.outerLines.opacity, (v) => { state.outerLines.opacity = v; }, (v) => v.toFixed(2));

    bindSlider(els.movementError, els.movementErrorVal,
      () => state.movementError, (v) => { state.movementError = v; }, (v) => v.toFixed(1));
    bindSlider(els.firingError, els.firingErrorVal,
      () => state.firingError, (v) => { state.firingError = v; }, (v) => v.toFixed(1));

    /* --- Simulation --- */
    els.simMovementBtn.addEventListener("click", () => {
      simMovement = !simMovement;
      els.simMovementBtn.setAttribute("aria-pressed", simMovement);
      renderCrosshair();
    });
    els.simFiringBtn.addEventListener("click", () => {
      simFiring = !simFiring;
      els.simFiringBtn.setAttribute("aria-pressed", simFiring);
      renderCrosshair();
    });

    /* --- Code Import --- */
    els.codeImportBtn.addEventListener("click", importCode);
    els.codeImport.addEventListener("keydown", (e) => {
      if (e.key === "Enter") importCode();
    });

    /* --- Copy --- */
    els.codeCopyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(generateCode());
        showToast("조준점 코드를 복사했습니다.");
      } catch {
        showToast(generateCode());
      }
    });

    /* --- Actions --- */
    els.resetBtn.addEventListener("click", () => {
      state = deepClone(DEFAULT_STATE);
      simMovement = false;
      simFiring = false;
      els.simMovementBtn.setAttribute("aria-pressed", "false");
      els.simFiringBtn.setAttribute("aria-pressed", "false");
      syncUIFromState();
      showToast("초기화되었습니다.");
    });

    els.randomBtn.addEventListener("click", () => {
      randomCrosshair();
      syncUIFromState();
      showToast("랜덤 조준선이 생성되었습니다.");
    });

    els.savePresetBtn.addEventListener("click", () => {
      const name = prompt("프리셋 이름을 입력하세요:");
      if (!name || !name.trim()) return;
      const presets = loadUserPresets();
      presets.push({ name: name.trim(), state: deepClone(state) });
      saveUserPresets(presets);
      renderUserPresets();
      showToast(`"${name.trim()}" 프리셋을 저장했습니다.`);
    });

    /* --- Section collapse --- */
    document.querySelectorAll(".cr-section-header").forEach((header) => {
      header.addEventListener("click", () => {
        header.closest(".cr-section").classList.toggle("is-open");
      });
    });

    /* --- Resize --- */
    let resizeRaf;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(renderCrosshair);
    });
  }

  function importCode() {
    const raw = els.codeImport.value.trim();
    if (!raw) {
      showToast("코드를 입력해 주세요.");
      return;
    }
    state = parseValorantCode(raw);
    syncUIFromState();
    showToast("코드를 불러왔습니다.");
  }

  /* ================================================
     Color Swatches Init
     ================================================ */

  function initSwatches() {
    els.colorSwatches.innerHTML = "";
    VALORANT_COLORS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cr-swatch";
      btn.dataset.color = c.hex;
      btn.title = c.name;

      const inner = document.createElement("span");
      inner.className = "cr-swatch-color";
      inner.style.background = c.hex;
      btn.appendChild(inner);

      btn.addEventListener("click", () => {
        state.color = c.hex;
        els.colorPicker.value = c.hex;
        syncSwatchHighlight();
        onStateChange();
      });

      els.colorSwatches.appendChild(btn);
    });
  }

  /* ================================================
     Init
     ================================================ */

  function init() {
    initCrosshairElements();
    initSwatches();
    bindEvents();
    renderProPresets();
    renderUserPresets();
    syncUIFromState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
