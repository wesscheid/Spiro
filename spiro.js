let params = {};
let spirographs = [];
let theta = 0;
let fullscreenMode = false;
let canvasEl = null;
let themeTransition = null;

function getCanvasSize() {
  const controls = document.getElementById("controls");
  const rect = controls?.getBoundingClientRect() || { width: 300, height: 300 };
  if (fullscreenMode) return { w: window.innerWidth, h: window.innerHeight };
  if (window.innerWidth <= 720) return { w: window.innerWidth, h: window.innerHeight - rect.height };
  return { w: window.innerWidth - rect.width, h: window.innerHeight };
}

function setup() {
  const { w, h } = getCanvasSize();
  const c = createCanvas(w, h);
  canvasEl = c.canvas;
  c.parent("canvas-container");
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(60);
  updateAllParams();
  resetSpirographs();
}

function windowResized() {
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);
  resetSpirographs();
}

function resetSpirographs() {
  spirographs = [];
  theta = 0;
  background(290, 80, 10);
}

function draw() {
  if (!params || Object.keys(params).length === 0) return;

  if (themeTransition) {
    const t = constrain((millis() - themeTransition.start) / themeTransition.duration, 0, 1);
    for (let key in themeTransition.to) {
      const fromVal = themeTransition.from[key];
      const toVal = themeTransition.to[key];
      if (typeof toVal === "number") {
        params[key] = lerp(fromVal, toVal, t);
      } else {
        params[key] = t < 0.5 ? fromVal : toVal;
      }
    }
    if (t >= 1) themeTransition = null;
  }

  fill(290, 80, 10, constrain(100 - params.trailLength / 20, 2, 95));
  noStroke();
  rect(0, 0, width, height);

  push();
  translate(width / 2, height / 2);
  scale(params.scale);
  let drift = radians(0.01 * frameCount);

  for (let i = 0; i < params.numPoints; i++) {
    push();
    rotate((i * TWO_PI) / params.numPoints + drift);
    for (let l = 0; l < params.numLayers; l++) drawCurve(i, l);
    pop();
  }
  pop();

  theta += params.animSpeed;
}

function drawCurve(index, layer) {
  let outerRadius = params.outerRadius;
  let innerRadius = params.innerRadius;
  let centerSize = params.centerSize;
  let currentTheta = theta;

  innerRadius += 20 * sin(frameCount * 0.002 + layer * 0.4);
  centerSize += 15 * cos(frameCount * 0.0015 + layer * 0.6);

  if (params.layerOffsetMode === "radius") outerRadius *= 1 + layer * params.layerOffsetAmount;
  else if (params.layerOffsetMode === "rotation") currentTheta += layer * params.layerOffsetAmount;
  else if (params.layerOffsetMode === "phase") currentTheta += layer * PI * params.layerOffsetAmount;

  if (params.reverseLayers && layer % 2 === 1) currentTheta *= -1;

  const c1 = computeCurve(params.curveType, currentTheta, outerRadius, innerRadius, centerSize);
  let x = c1.x, y = c1.y;

  if (params.dualCurveMode) {
    const c2 = computeCurve(params.secondaryCurve, currentTheta, outerRadius * 0.8, innerRadius * 0.8, centerSize * 0.8);
    if (params.dualModeType === "blend") {
      const t = sin(frameCount * 0.002) * 0.5 + 0.5;
      x = lerp(c1.x, c2.x, t);
      y = lerp(c1.y, c2.y, t);
    } else if (params.dualModeType === "combine") {
      x = c1.x + c2.x;
      y = c1.y + c2.y;
    } else if (params.dualModeType === "alternate" && layer % 2 === 1) {
      x = c2.x;
      y = c2.y;
    }
  }

  if (!spirographs[index]) spirographs[index] = [];
  if (!spirographs[index][layer]) spirographs[index][layer] = [];
  const arr = spirographs[index][layer];
  arr.push({ x, y });
  while (arr.length > params.trailLength) arr.shift();

  if (arr.length > 1) {
    let hue = (params.baseHue + (index * params.colorSpread / params.numPoints) + layer * 40) % 360;
    for (let j = 1; j < arr.length; j++) {
      const prev = arr[j - 1], curr = arr[j];
      const factor = j / arr.length;
      stroke(hue, 70, 95, 20 + 65 * factor);
      strokeWeight(max(0.05, params.lineWeight * (1 - params.lineThinning * (1 - factor))));
      line(prev.x, prev.y, curr.x, curr.y);
    }
  }
}

function computeCurve(type, t, outer, inner, center) {
  let x = 0, y = 0;
  if (type === "hypotrochoid") {
    x = (outer - inner) * cos(t) + center * cos(((outer - inner) / inner) * t);
    y = (outer - inner) * sin(t) - center * sin(((outer - inner) / inner) * t);
  } else if (type === "epitrochoid") {
    x = (outer + inner) * cos(t) - center * cos(((outer + inner) / inner) * t);
    y = (outer + inner) * sin(t) - center * sin(((outer + inner) / inner) * t);
  } else if (type === "rose") {
    let k = inner / outer;
    let r = outer * cos(k * t);
    x = r * cos(t);
    y = r * sin(t);
  } else if (type === "lissajous") {
    let a = max(1, int(outer / 20)), b = max(1, int(inner / 20)), delta = center * 0.01;
    x = outer * sin(a * t + delta);
    y = inner * sin(b * t);
  } else if (type === "superformula") {
    let m = 6, n1 = 0.3, n2 = 1.7, n3 = 1.7, a = 1, b = 1;
    let part1 = pow(abs(cos((m * t) / 4) / a), n2);
    let part2 = pow(abs(sin((m * t) / 4) / b), n3);
    let denom = pow(part1 + part2, 1 / n1);
    let r = denom === 0 ? 0 : 1.0 / denom;
    x = outer * r * cos(t);
    y = outer * r * sin(t);
  } else if (type === "harmonograph") {
    let scaledT = t * 0.02;
    let A = outer * 0.5, B = inner * 0.5;
    let f1 = 2.0, f2 = 3.0, d1 = 0.0006, d2 = 0.0008;
    x = A * sin(f1 * scaledT + 0.5) * exp(-d1 * scaledT);
    y = B * sin(f2 * scaledT) * exp(-d2 * scaledT);
  }
  return { x, y };
}

function updateAllParams() {
  const get = id => document.getElementById(id);
  params.curveType = get("curveType")?.value || "hypotrochoid";
  params.dualCurveMode = get("dualCurveMode")?.checked || false;
  params.secondaryCurve = get("secondaryCurve")?.value || params.curveType;
  params.dualModeType = get("dualModeType")?.value || "blend";

  params.outerRadius = parseFloat(get("outerRadius")?.value || 180);
  params.innerRadius = parseFloat(get("innerRadius")?.value || 80);
  params.centerSize = parseFloat(get("centerSize")?.value || 60);
  params.numPoints = parseInt(get("numPoints")?.value || 12, 10);
  params.scale = parseFloat(get("scale")?.value || 1.0);
  params.numLayers = parseInt(get("numLayers")?.value || 2, 10);
  params.layerOffsetMode = get("layerOffsetMode")?.value || "radius";
  params.layerOffsetAmount = parseFloat(get("layerOffsetAmount")?.value || 0.06);
  params.reverseLayers = get("reverseLayers")?.checked || false;

  params.animSpeed = parseFloat(get("animSpeed")?.value || 0.02);
  params.trailLength = parseInt(get("trailLength")?.value || 120, 10);
  params.lineWeight = parseFloat(get("lineWeight")?.value || 1.6);
  params.lineThinning = parseFloat(get("lineThinning")?.value || 0.7);
  params.baseHue = parseFloat(get("baseHue")?.value || 260);
  params.colorSpread = parseFloat(get("colorSpread")?.value || 120);
}

function shuffleTheme() {
  if (!Array.isArray(window.themes) || themes.length === 0) return;
  const choice = themes[Math.floor(Math.random() * themes.length)];

  themeTransition = {
    from: { ...params },
    to: {
      curveType: choice.curveType || "hypotrochoid",
      dualCurveMode: !!choice.dual,
      secondaryCurve: choice.secondary || "hypotrochoid",
      dualModeType: choice.dualMode || "blend",
      outerRadius: choice.outer ?? 180,
      innerRadius: choice.inner ?? 80,
      centerSize: choice.center ?? 60,
      numPoints: choice.points ?? 12,
      scale: choice.scale ?? 1.0,
      numLayers: choice.layers ?? 2,
      layerOffsetMode: choice.offset || "radius",
      layerOffsetAmount: choice.offsetAmount ?? 0.06,
      reverseLayers: !!choice.reverse,
      animSpeed: choice.speed ?? 0.02,
      trailLength: choice.trail ?? 120,
      lineWeight: choice.lineWeight ?? 1.6,
      lineThinning: choice.lineThinning ?? 0.7,
      baseHue: choice.hue ?? 260,
      colorSpread: choice.spread ?? 120
    },
    start: millis(),
    duration: 250
  };
}

function toggleFullscreenCanvas() {
  const container = document.getElementById("canvas-container");
  const controls = document.getElementById("controls");

  if (!document.fullscreenElement) {
    container?.requestFullscreen().then(() => {
      fullscreenMode = true;
      if (controls) controls.style.display = "none";
      const { w, h } = getCanvasSize();
      resizeCanvas(w, h);
      resetSpirographs();
    });
  } else {
    document.exitFullscreen().then(() => {
      fullscreenMode = false;
      if (controls) controls.style.display = "block";
      const { w, h } = getCanvasSize();
      resizeCanvas(w, h);
      resetSpirographs();
    });
  }
}

document.addEventListener("fullscreenchange", () => {
  const controls = document.getElementById("controls");
  fullscreenMode = !!document.fullscreenElement;
  if (controls) controls.style.display = fullscreenMode ? "none" : "block";
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);
  resetSpirographs();
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fullscreenToggle")?.addEventListener("click", toggleFullscreenCanvas);
  document.getElementById("shuffleTheme")?.addEventListener("click", shuffleTheme);

  document.querySelectorAll("input[type=range]").forEach(input => {
    const display = document.getElementById(input.id + "-value");
    if (display) {
      display.textContent = String(input.step || "").includes('.') ? parseFloat(input.value).toFixed(2) : Math.round(input.value);
    }
    input.addEventListener("input", () => {
      const display = document.getElementById(input.id + "-value");
      if (display) {
        display.textContent = String(input.step || "").includes('.') ? parseFloat(input.value).toFixed(2) : Math.round(input.value);
      }
      updateAllParams();
      resetSpirographs();
    });
  });

  document.querySelectorAll("select, input[type=checkbox]").forEach(el => {
    el.addEventListener("change", () => {
      updateAllParams();
      resetSpirographs();
    });
  });

  updateAllParams();
  resetSpirographs();
});// spiro.js — resilient version for mobile/overlays + Option B dot
// - Debounced resize/fullscreen; no hard reset on resize
// - Guards resizeCanvas until p5 is ready (prevents "resizeCanvas is not defined")
// - Debounced hard reset for geometry sliders so trails can grow
// - Legacy aliases + numberOfPoints <-> numPoints mirror
// - Option B: draw a dot when a trail has only one point
// - push/pop around translated drawing so transforms don't leak

let params = {};
let spirographs = [];
let theta = 0;
let fullscreenMode = false;
let canvasEl = null;
let themeTransition = null; // used for theme shuffle
let transitions = []; // used for smoothing aesthetic parameter changes

let p5Ready = false;
let resizeTimer = null;
let lastCanvasSize = { w: 0, h: 0 };
let hardResetTimer = null;

// Legacy/global aliases so old code/console still works
if (typeof window !== 'undefined') {
  window.params = params;
  window.currentParams = params;   // legacy alias
  window.spiroParams = params;     // legacy alias
}

// Mirror numberOfPoints <-> numPoints
try {
  Object.defineProperty(params, 'numberOfPoints', {
    get() { return this.numPoints; },
    set(v) { this.numPoints = v; },
    enumerable: true,
    configurable: true
  });
} catch (e) {}

// Parameters that can be smoothly transitioned without hard resets
const AESTHETIC_PARAMS = [
  'animSpeed',
  'trailLength',
  'lineWeight',
  'lineThinning',
  'baseHue',
  'colorSpread',
  'scale'
];

function ensureLayerArrays(count) {
  if (!Array.isArray(spirographs)) spirographs = [];
  // Grow
  for (let i = spirographs.length; i < count; i++) spirographs[i] = [];
  // Shrink
  if (spirographs.length > count) spirographs.length = count;
}

function getCanvasSize() {
  const controls = document.getElementById("controls");
  const rect = controls?.getBoundingClientRect() || { width: 300, height: 300 };
  if (fullscreenMode) return { w: window.innerWidth, h: window.innerHeight };
  if (window.innerWidth <= 720) return { w: window.innerWidth, h: window.innerHeight - rect.height };
  return { w: window.innerWidth - rect.width, h: window.innerHeight };
}

// Debounced resize handler (no hard reset)
function onWindowResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!p5Ready) return;
    const { w, h } = getCanvasSize();
    if (w === lastCanvasSize.w && h === lastCanvasSize.h) return;
    if (typeof resizeCanvas === 'function') {
      resizeCanvas(w, h);
    } else if (canvasEl) {
      // Fallback if p5 isn't exposed in global mode (should be rare)
      canvasEl.width = w;
      canvasEl.height = h;
    }
    lastCanvasSize = { w, h };
    // Do NOT reset trail here; let it continue to grow
  }, 150);
}

// Debounced hard reset for geometry changes
function scheduleHardReset(delay = 200) {
  if (hardResetTimer) clearTimeout(hardResetTimer);
  hardResetTimer = setTimeout(() => {
    resetSpirographs();
  }, delay);
}

function setup() {
  const { w, h } = getCanvasSize();
  const c = createCanvas(w, h);
  canvasEl = c.canvas;
  c.parent("canvas-container");
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(60);
  strokeCap(ROUND);
  updateAllParams();
  resetSpirographs();

  // Mark p5 ready and attach listeners after p5 exists
  p5Ready = true;
  lastCanvasSize = { w: width, h: height };

  window.addEventListener("resize", onWindowResize);
  document.addEventListener("fullscreenchange", () => {
    const controls = document.getElementById("controls");
    fullscreenMode = !!document.fullscreenElement;
    if (controls) controls.style.display = fullscreenMode ? "none" : "block";
    onWindowResize(); // just resize; no hard reset
  });
}

function resetSpirographs() {
  spirographs = [];
  ensureLayerArrays(params.numLayers);
  theta = 0;
  const bgHue = params.baseHue !== undefined ? params.baseHue : 290;
  background(bgHue, 80, 10);
}
// =================================================================
// PRIMARY DRAW LOOP LOGIC
// =================================================================

function draw() {
  if (!params || Object.keys(params).length === 0) return;

  // 1. Handle themeTransition (shuffle) if active
  if (themeTransition) {
    const t = constrain((millis() - themeTransition.start) / themeTransition.duration, 0, 1);
    for (const key in themeTransition.to) {
      if (typeof themeTransition.from[key] === 'number') {
        params[key] = lerp(themeTransition.from[key], themeTransition.to[key], t);
      } else {
        params[key] = themeTransition.to[key];
      }
    }
    if (t === 1) {
      themeTransition = null;
    }
  }

  // 1.b Handle smaller transitions[] (aesthetic param smoothing)
  updateTransitions();

  // 2. Redraw Background and Path
  const bgAlpha = params.trailLength > 0 ? 5 : 100;
  background(params.baseHue, 80, 10, bgAlpha);

  // Ensure animSpeed is never zero
  theta += max(0.001, params.animSpeed);

  // Recalculate and draw the current frame
  drawSpirograph();

  // 3. Flash effect if any (full overlay in screen coords)
  if (params.flash > 0) {
    push();
    noStroke();
    fill(0, 0, 100, params.flash);
    rectMode(CORNER);
    rect(0, 0, width, height);
    pop();
  }
}

// =================================================================
function startParameterTransition(paramName, newValue, duration = 300) {
  // Remove existing transition for same param
  transitions = transitions.filter(t => t.param !== paramName);

  transitions.push({
    param: paramName,
    from: params[paramName],
    to: newValue,
    start: millis(),
    duration: duration
  });
}

function updateTransitions() {
  if (!transitions || transitions.length === 0) return;

  const now = millis();
  for (let i = transitions.length - 1; i >= 0; i--) {
    const t = transitions[i];
    const elapsed = now - t.start;
    const pct = constrain(elapsed / t.duration, 0, 1);
    const eased = easeInOutCubic(pct);
    params[t.param] = lerp(t.from, t.to, eased);
    if (pct >= 1) transitions.splice(i, 1);
  }
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function updateAllParams() {
  const el = id => document.getElementById(id);

  params.curveType = el('curveType') ? el('curveType').value : (params.curveType ?? 'hypotrochoid');
  params.outerRadius = el('outerRadius') ? parseFloat(el('outerRadius').value) : (params.outerRadius ?? 180);
  params.innerRadius = el('innerRadius') ? parseFloat(el('innerRadius').value) : (params.innerRadius ?? 80);
  params.centerSize = el('centerSize') ? parseFloat(el('centerSize').value) : (params.centerSize ?? 60);

  // Support either #numPoints or #numberOfPoints
  {
    const npEl = el('numPoints') || el('numberOfPoints');
    const raw = npEl ? parseInt(npEl.value, 10) : params.numPoints;
    params.numPoints = Number.isFinite(raw) ? raw : (params.numPoints ?? 12);
  }

  params.dualCurveMode = el('dualCurveMode') ? el('dualCurveMode').checked : (params.dualCurveMode ?? false);
  params.secondaryCurve = el('secondaryCurve') ? el('secondaryCurve').value : (params.secondaryCurve ?? 'hypotrochoid');
  params.dualModeType = el('dualModeType') ? el('dualModeType').value : (params.dualModeType ?? 'blend');

  params.numLayers = el('numLayers') ? parseInt(el('numLayers').value, 10) : (params.numLayers ?? 2);
  params.layerOffsetMode = el('layerOffsetMode') ? el('layerOffsetMode').value : (params.layerOffsetMode ?? 'radius');
  params.layerOffsetAmount = el('layerOffsetAmount') ? parseFloat(el('layerOffsetAmount').value) : (params.layerOffsetAmount ?? 0.06);
  params.reverseLayers = el('reverseLayers') ? el('reverseLayers').checked : (params.reverseLayers ?? false);

  params.scale = el('scale') ? parseFloat(el('scale').value) : (params.scale ?? 1.0);
  params.animSpeed = el('animSpeed') ? parseFloat(el('animSpeed').value) : (params.animSpeed ?? 0.04);
  params.trailLength = el('trailLength') ? parseInt(el('trailLength').value, 10) : (params.trailLength ?? 50);
  params.lineWeight = el('lineWeight') ? parseFloat(el('lineWeight').value) : (params.lineWeight ?? 1.6);
  params.lineThinning = el('lineThinning') ? parseFloat(el('lineThinning').value) : (params.lineThinning ?? 0.7);
  params.baseHue = el('baseHue') ? parseFloat(el('baseHue').value) : (params.baseHue ?? 260);
  params.colorSpread = el('colorSpread') ? parseFloat(el('colorSpread').value) : (params.colorSpread ?? 120);

  params.flash = params.flash ?? 0;
}

// =================================================================
// SHUFFLE THEME FUNCTION
// =================================================================

function shuffleTheme() {
  if (!Array.isArray(window.themes) || window.themes.length === 0) return;

  const choice = window.themes[Math.floor(Math.random() * window.themes.length)];

  // HARD RESET CORE LOGIC
  spirographs = [];
  theta = 0;

  // Apply geometric params
  params.curveType = choice.curveType || "hypotrochoid";
  params.dualCurveMode = !!choice.dual;
  params.secondaryCurve = choice.secondary || "hypotrochoid";
  params.dualModeType = choice.dualMode || "blend";

  params.outerRadius = choice.outer ?? 180;
  params.innerRadius = choice.inner ?? 80;
  params.centerSize = choice.center ?? 60;
  params.numPoints = choice.points ?? 12;
  params.numLayers = choice.layers ?? 2;

  params.layerOffsetMode = choice.offset || "radius";
  params.layerOffsetAmount = choice.offsetAmount ?? 0.06;
  params.reverseLayers = !!choice.reverse;

  // Clear background and set base hue
  const newHue = choice.hue ?? 260;
  background(newHue, 80, 10);
  params.baseHue = newHue;

  // Transition aesthetics + flash
  themeTransition = {
    from: {
      animSpeed: params.animSpeed,
      trailLength: params.trailLength,
      lineWeight: params.lineWeight,
      lineThinning: params.lineThinning,
      colorSpread: params.colorSpread,
      scale: params.scale,
      flash: 70
    },
    to: {
      animSpeed: choice.speed ?? 0.02,
      trailLength: choice.trail ?? 120,
      lineWeight: choice.lineWeight ?? 1.6,
      lineThinning: choice.lineThinning ?? 0.7,
      colorSpread: choice.spread ?? 120,
      scale: choice.scale ?? 1.0,
      flash: 0
    },
    start: millis(),
    duration: 250
  };
}

// =================================================================
// GEOMETRY MATH (Spirographs)
// =================================================================

function getPolarCoordinate(thetaLocal, layer) {
  // choose which curve to use for this layer
  let curveTypeLocal = layer % 2 === 0 ? params.curveType : params.secondaryCurve;
  if (!params.dualCurveMode) curveTypeLocal = params.curveType;

  // Layer offsets
  let rOffset = 0;
  let tOffset = 0;

  if (params.numLayers > 1) {
    if (params.layerOffsetMode === "radius") {
      rOffset = layer * params.layerOffsetAmount * params.outerRadius;
    } else if (params.layerOffsetMode === "rotation") {
      tOffset = layer * params.layerOffsetAmount * TWO_PI;
    } else if (params.layerOffsetMode === "phase") {
      tOffset = layer * params.layerOffsetAmount * HALF_PI;
    }
  }

  let directionalFactor = 1;
  if (params.reverseLayers) {
    directionalFactor = (layer % 2 === 0) ? 1 : -1;
  }

  if (directionalFactor === -1 && (params.layerOffsetMode === "rotation" || params.layerOffsetMode === "phase")) {
    tOffset *= -1;
  }

  const currentTheta = (thetaLocal * directionalFactor) + tOffset;

  let x = 0, y = 0, r = 0;
  const Rbase = params.outerRadius + rOffset;
  const r_ = params.innerRadius;
  const d = params.centerSize;

  switch (curveTypeLocal) {
    case "epitrochoid": {
      const R = Rbase;
      const k = R / r_;
      const rotationFactor = k + 1;
      const secondAngle = currentTheta * rotationFactor;
      x = (R + r_) * cos(currentTheta) - d * cos(secondAngle);
      y = (R + r_) * sin(currentTheta) - d * sin(secondAngle);
      break;
    }

    case "rose": {
      const n = Math.max(1, Math.round(params.numPoints));
      r = Rbase * cos(n * currentTheta);
      x = r * cos(currentTheta);
      y = r * sin(currentTheta);
      break;
    }

    case "lissajous": {
      const freqX = params.numPoints / 2;
      const freqY = params.numPoints / 3;
      const ampX = Rbase;
      const ampY = r_;
      const phase = params.layerOffsetAmount * PI;
      x = ampX * sin(freqX * currentTheta + phase);
      y = ampY * cos(freqY * currentTheta);
      break;
    }

    case "superformula": {
      const m = params.numPoints;
      const n1 = 1.0, n2 = 1.0, n3 = 1.0;
      const a = 1, b = 1;
      const phi = currentTheta;
      const t1 = Math.pow(Math.abs(Math.cos(m * phi / 4) / a), n2);
      const t2 = Math.pow(Math.abs(Math.sin(m * phi / 4) / b), n3);
      r = (Rbase) / Math.pow((t1 + t2), (1 / n1));
      x = r * Math.cos(phi);
      y = r * Math.sin(phi);
      break;
    }

    case "harmonograph": {
      const freq1 = params.numPoints;
      const freq2 = params.numPoints * 0.99;
      const phase1 = params.layerOffsetAmount * PI;
      const phase2 = params.layerOffsetAmount * HALF_PI;
      const damp = 0.9999;
      x = (Rbase) * cos(freq1 * currentTheta + phase1) * Math.pow(damp, currentTheta);
      y = (r_) * sin(freq2 * currentTheta + phase2) * Math.pow(damp, currentTheta);
      break;
    }

    default: { // hypotrochoid
      let R = Rbase;
      if (curveTypeLocal === "hypotrochoid" && Math.abs(R - r_) < 0.01) {
        R = r_ * 1.01;
      }
      const k = R / r_;
      const rotationFactor = (curveTypeLocal === "hypotrochoid") ? (k - 1) : (k + 1);
      const secondAngle = currentTheta * rotationFactor;

      x = (R - r_) * cos(currentTheta) + d * cos(secondAngle);
      y = (R - r_) * sin(currentTheta) - d * sin(secondAngle);
    }
  }

  return createVector(x * params.scale, y * params.scale);
}

// =================================================================
// DRAW SPIROGRAPH (trail handling, per-layer drawing)
// =================================================================

function drawSpirograph() {
  push();
  noFill();
  translate(width / 2, height / 2);

  // Always match spirographs to current layer count
  ensureLayerArrays(params.numLayers);

  // Coerce and allow 0 for ephemeral dot mode
  const maxLen = Math.max(0, params.trailLength | 0);

  // Add the current point for each layer - SIMPLER FIX: just use numPoints in the calculations
  for (let i = 0; i < params.numLayers; i++) {
    const point = getPolarCoordinate(theta, i);
    if (maxLen > 0) {
      spirographs[i].push(point);
      if (spirographs[i].length > maxLen) spirographs[i].shift();
    } else {
      // No history; don't accumulate
      spirographs[i] = [];
    }
  }

  // Draw
  if (maxLen > 0) {
    for (let i = 0; i < params.numLayers; i++) {
      const layer = spirographs[i];

      for (let j = 0; j < layer.length; j++) {
        const p = layer[j];
        const t = (layer.length > 0) ? j / layer.length : 0;

        let colorFactor = 1;
        if (params.reverseLayers) colorFactor = (i % 2 === 0) ? 1 : -1;

        const hueVal = (params.baseHue + (t * params.colorSpread * colorFactor) + (i * 360 / Math.max(1, params.numLayers))) % 360;
        const alpha = map(t, 0, 1, 30, 100);
        const weight = map(t, 0, 1, params.lineWeight * params.lineThinning, params.lineWeight);

        stroke(hueVal, 80, 95, alpha);
        strokeWeight(weight);

        if (j > 0) {
          const pPrev = layer[j - 1];
          line(pPrev.x, pPrev.y, p.x, p.y);
        } else if (layer.length === 1) {
          // Option B: draw a dot when only one sample exists
          point(p.x, p.y);
        }
      }
    }
  } else {
    // Ephemeral dot mode: draw just the current frame's point per layer
    for (let i = 0; i < params.numLayers; i++) {
      const p = getPolarCoordinate(theta, i);

      let colorFactor = 1;
      if (params.reverseLayers) colorFactor = (i % 2 === 0) ? 1 : -1;

      const hueVal = (params.baseHue + (i * 360 / Math.max(1, params.numLayers))) % 360;
      stroke(hueVal, 80, 95, 100);
      strokeWeight(params.lineWeight * params.lineThinning);
      point(p.x, p.y);
    }
  }
  pop();
}

// =================================================================
// UI INITIALIZATION AND EVENT LISTENERS
// =================================================================

function toggleFullscreenCanvas() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`);
    });
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  } else {
    console.error('Fullscreen is not supported');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("fullscreenToggle")?.addEventListener("click", toggleFullscreenCanvas);
  document.getElementById("shuffleTheme")?.addEventListener("click", shuffleTheme);

  // Slider & control initialization
  document.querySelectorAll("input[type=range]").forEach(input => {
    const display = document.getElementById(input.id + "-value");

    // Initial display value
    if (display) {
      display.textContent = String(input.step || "").includes('.')
        ? parseFloat(input.value).toFixed(2)
        : Math.round(input.value);
    }

    input.addEventListener("input", () => {
      // Update display value
      const ds = document.getElementById(input.id + "-value");
      if (ds) {
        ds.textContent = String(input.step || "").includes('.')
          ? parseFloat(input.value).toFixed(2)
          : Math.round(input.value);
      }

      const paramName = input.id;
      const newValue = parseFloat(input.value);

      if (AESTHETIC_PARAMS.includes(paramName)) {
        // Smooth transition for aesthetic params
        startParameterTransition(paramName, newValue, 300);
      } else {
        // Geometry update: apply immediately but debounce the hard reset
        if (themeTransition) themeTransition = null;
        updateAllParams();
        scheduleHardReset(200);
      }
    });
  });

  // Selects and checkboxes trigger immediate hard reset on change
  document.querySelectorAll("select, input[type=checkbox]").forEach(el => {
    el.addEventListener("change", () => {
      if (themeTransition) themeTransition = null;
      updateAllParams();
      resetSpirographs();
    });
  });

  // Initial parameter population
  updateAllParams();
});

// =================================================================
// End of file
// =================================================================
