// spiro.js — resilient version for mobile/overlays + Option B dot
// - Debounced resize/fullscreen; no hard reset on resize
// - Guards resizeCanvas until p5 is ready (prevents "resizeCanvas is not defined")
// - Debounced hard reset for geometry sliders so trails can grow
// - Legacy aliases + numberOfPoints <-> numPoints mirror
// - Option B: draw a dot when a trail has only one point
// - push/pop around translated drawing so transforms don’t leak

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
  push(); // ensure translate doesn't leak
  noFill();
  translate(width / 2, height / 2);

  if (spirographs.length === 0) {
    for (let i = 0; i < params.numLayers; i++) spirographs.push([]);
  }

  // Add the current point for each layer
  for (let i = 0; i < params.numLayers; i++) {
    const point = getPolarCoordinate(theta, i);
    spirographs[i].push(point);
  }

  // Trim trails
  const maxLen = Math.max(0, params.trailLength | 0);
  for (let i = 0; i < params.numLayers; i++) {
    const layer = spirographs[i];
    while (layer.length > maxLen && maxLen > 0) layer.shift();
    if (maxLen === 0) spirographs[i] = []; // no history
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
    // No history: draw an ephemeral dot per layer
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
