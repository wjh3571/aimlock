function extractPrimaryCrosshairCode(full) {
  const s = String(full || "");
  const rest = s;
  const adsStart = rest.indexOf(";A;");
  const sniperStart = rest.indexOf(";S;");
  const cuts = [adsStart, sniperStart].filter((i) => i >= 0);
  const end = cuts.length ? Math.min(...cuts) : rest.length;
  return rest.slice(0, end);
}

function extractSniperCrosshairCode(full) {
  const s = String(full || "");
  const idx = s.indexOf(";S;");
  if (idx < 0) return extractPrimaryCrosshairCode(full);
  return s.slice(idx + 3);
}

function crosshairCodeForWeapon(full, weapon, zoomed) {
  if (weapon === "operator" && zoomed) return extractSniperCrosshairCode(full);
  return extractPrimaryCrosshairCode(full);
}

function valorantColorFromIndex(idx) {
  const palette = [
    "#ffffff",
    "#00ff00",
    "#7fff00",
    "#dfff00",
    "#ffff00",
    "#00ffff",
    "#ff00ff",
    "#ff0000",
  ];
  return palette[idx] || "#ffffff";
}

function clamp01(value, fallback = 1) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function num(value, fallback = 0) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseValorantCode(code) {
  const parts = String(code || "").split(";");
  const r = {
    color: "#ffffff",
    outlineOn: false,
    outlineOpacity: 0.5,
    outlineThick: 1,
    dotOn: false,
    dotSize: 2,
    dotOpacity: 1,
    inner: {
      show: true,
      lenH: null,
      lenV: null,
      independent: false,
      thick: 2,
      offset: 0,
      opacity: 1,
    },
    outer: {
      show: false,
      lenH: 0,
      lenV: null,
      independent: false,
      thick: 2,
      offset: 0,
      opacity: 1,
    },
  };

  for (let i = 0; i < parts.length - 1; i += 1) {
    const k = parts[i];
    const v = parts[i + 1];

    switch (k) {
      case "c":
        if (/^\d+$/.test(v)) r.color = valorantColorFromIndex(Number.parseInt(v, 10));
        break;
      case "u":
        if (/^[0-9A-Fa-f]{8}$/.test(v)) r.color = "#" + v.slice(0, 6);
        break;
      case "h":
        r.outlineOn = v === "1";
        break;
      case "o":
        r.outlineOpacity = clamp01(v, r.outlineOpacity);
        if (r.outlineOpacity > 0) r.outlineOn = true;
        break;
      case "t":
        r.outlineThick = num(v, r.outlineThick);
        break;
      case "d":
        r.dotOn = v === "1";
        break;
      case "z":
        r.dotSize = num(v, r.dotSize);
        break;
      case "a":
        r.dotOpacity = clamp01(v, r.dotOpacity);
        break;
      case "0b":
        r.inner.show = v !== "0";
        break;
      case "0l":
        r.inner.lenH = num(v, 0);
        break;
      case "0v":
        r.inner.lenV = num(v, 0);
        break;
      case "0g":
        r.inner.independent = v === "1";
        break;
      case "0t":
        r.inner.thick = num(v, r.inner.thick);
        break;
      case "0o":
        r.inner.offset = num(v, r.inner.offset);
        break;
      case "0a":
        r.inner.opacity = clamp01(v, r.inner.opacity);
        break;
      case "1b":
        r.outer.show = v !== "0";
        break;
      case "1l":
        r.outer.lenH = num(v, 0);
        break;
      case "1v":
        r.outer.lenV = num(v, 0);
        break;
      case "1g":
        r.outer.independent = v === "1";
        break;
      case "1t":
        r.outer.thick = num(v, r.outer.thick);
        break;
      case "1o":
        r.outer.offset = num(v, r.outer.offset);
        break;
      case "1a":
        r.outer.opacity = clamp01(v, r.outer.opacity);
        break;
      default:
        break;
    }
  }

  if (r.inner.lenH == null) r.inner.lenH = 6;
  if (r.inner.lenV == null) r.inner.lenV = r.inner.lenH;
  if (r.outer.lenV == null) r.outer.lenV = r.outer.lenH;
  if (!r.inner.independent) r.inner.lenV = r.inner.lenH;
  if (!r.outer.independent) r.outer.lenV = r.outer.lenH;
  if (r.inner.lenH <= 0 && r.inner.lenV <= 0) r.inner.show = false;
  if (r.outer.lenH > 0 || r.outer.lenV > 0) r.outer.show = r.outer.show !== false;

  return r;
}

function lengthToPx(value, size) {
  return Math.round((value * size) / 52);
}

function thicknessToPx(value, size) {
  return Math.round((value * size) / 96);
}

function outlineToPx(value, size) {
  return Math.round((value * size) / 120);
}

function drawRect(ctx, x, y, w, h, color, alpha = 1) {
  if (w <= 0 || h <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, color, alpha, outline) {
  if (outline.enabled) {
    drawRect(
      ctx,
      x - outline.size,
      y - outline.size,
      w + outline.size * 2,
      h + outline.size * 2,
      "#10131b",
      outline.alpha
    );
  }
  drawRect(ctx, x, y, w, h, color, alpha);
}

function drawLineSet(ctx, p, line, size) {
  if (!line.show) return;

  const cx = size / 2;
  const cy = size / 2;
  const lenH = lengthToPx(line.lenH, size);
  const lenV = lengthToPx(line.lenV, size);
  const thick = Math.max(1, thicknessToPx(line.thick, size));
  const offset = lengthToPx(line.offset, size);
  const outline = {
    enabled: p.outlineOn,
    size: Math.max(1, outlineToPx(p.outlineThick, size)),
    alpha: p.outlineOpacity,
  };

  if (lenH > 0) {
    drawBar(ctx, cx - offset - lenH, cy - thick / 2, lenH, thick, p.color, line.opacity, outline);
    drawBar(ctx, cx + offset, cy - thick / 2, lenH, thick, p.color, line.opacity, outline);
  }

  if (lenV > 0) {
    drawBar(ctx, cx - thick / 2, cy - offset - lenV, thick, lenV, p.color, line.opacity, outline);
    drawBar(ctx, cx - thick / 2, cy + offset, thick, lenV, p.color, line.opacity, outline);
  }
}

function drawCrosshair(ctx, code, size, weapon, zoomed) {
  const w = size;
  const section =
    weapon === "operator" && zoomed
      ? extractSniperCrosshairCode(code)
      : extractPrimaryCrosshairCode(code);
  const p = parseValorantCode(section);

  drawLineSet(ctx, p, p.outer, w);
  drawLineSet(ctx, p, p.inner, w);

  if (p.dotOn) {
    const dot = Math.max(1, thicknessToPx((p.dotSize || p.inner.thick) * 2, w));
    const x = w / 2 - dot / 2;
    const y = w / 2 - dot / 2;
    const outline = {
      enabled: p.outlineOn,
      size: Math.max(1, outlineToPx(p.outlineThick, w)),
      alpha: p.outlineOpacity,
    };
    drawBar(ctx, x, y, dot, dot, p.color, p.dotOpacity, outline);
  }
}

function crosshairPreviewDataUrl(code, uiType, size) {
  const w = size || 240;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = w;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const bg = ctx.createLinearGradient(0, 0, 0, w);
  bg.addColorStop(0, "#647086");
  bg.addColorStop(1, "#33394b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, w);

  drawCrosshair(ctx, code, w);

  return canvas.toDataURL("image/png");
}

window.drawCrosshair = drawCrosshair;
window.parseValorantCode = parseValorantCode;
window.extractPrimaryCrosshairCode = extractPrimaryCrosshairCode;
window.extractSniperCrosshairCode = extractSniperCrosshairCode;
window.crosshairCodeForWeapon = crosshairCodeForWeapon;
