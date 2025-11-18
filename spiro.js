let params = {};
let spirographs = [];
let theta = 0;
let fullscreenMode = false;
let canvasEl = null;
let themeTransition = null;
let fadeState = "none";
let fadeAlpha = 0;
let autoPlayTimer = null;
let autoPlayCountdown = 0;
let listenerController = new AbortController();

// Auto-scale padding factor (0.75 = 25% padding on all sides)
const AUTOSCALE_PADDING = 0.75;

// Performance optimization: trig cache
let trigCache = { sin: {}, cos: {} };
function cachedSin(x) {
  const key = x.toFixed(4);
  if (!(key in trigCache.sin)) trigCache.sin[key] = Math.sin(x);
  return trigCache.sin[key];
}
function cachedCos(x) {
  const key = x.toFixed(4);
  if (!(key in trigCache.cos)) trigCache.cos[key] = Math.cos(x);
  return trigCache.cos[key];
}

function randomizeParameters() {
  const curveTypes = ["hypotrochoid", "epitrochoid", "rose", "lissajous", "superformula", "harmonograph", "hypocycloid", "epicycloid", "cycloid", "trochoid", "limacon", "ellipse", "butterfly", "astroid", "bicorn", "freeth's nephroid", "cardioid"];
  const primaryCurve = curveTypes[Math.floor(Math.random() * curveTypes.length)];
  const secondaryCurve = curveTypes[Math.floor(Math.random() * curveTypes.length)];

  currentThemeName = "Random";

  nextTheme = {
    name: "Random",
    curveType: primaryCurve,
    dual: Math.random() > 0.6,
    secondary: secondaryCurve,
    dualMode: ["blend", "combine", "alternate"][Math.floor(Math.random() * 3)],
    outer: Math.floor(Math.random() * 280) + 80,
    inner: Math.floor(Math.random() * 200) + 20,
    center: Math.floor(Math.random() * 200) + 20,
    points: Math.floor(Math.random() * 32) + 4,
    layers: Math.floor(Math.random() * 6) + 1,
    offset: ["radius", "rotation", "phase"][Math.floor(Math.random() * 3)],
    offsetAmount: Math.random() * 0.5 + 0.02,
    reverse: Math.random() > 0.5,
    speed: Math.random() * 0.035 + 0.005,
    trail: Math.floor(Math.random() * 200) + 30,
    lineWeight: Math.random() * 4 + 0.5,
    lineThinning: Math.random() * 0.9 + 0.1,
    hue: Math.floor(Math.random() * 360),
    spread: Math.floor(Math.random() * 300) + 30,
    m: Math.random() * 18 + 1,
    n1: Math.random() * 8 + 0.2,
    n2: Math.random() * 8 + 0.2,
    n3: Math.random() * 8 + 0.2,
    f1: Math.random() * 9 + 0.5,
    f2: Math.random() * 9 + 0.5,
    d1: Math.random() * 0.005 + 0.0001,
    d2: Math.random() * 0.005 + 0.0001
  };

  nextTheme.scale = params.scale;

  resetSpirographs();
  fadeState = "fading-out";
}

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
  fadeAlpha = 0;

  setupEventListeners();

  // Initialize themes array if themes.js hasn't loaded yet
  if (!window.themes) {
    window.themes = [];
  }
  
  window.themes.forEach(t => t.isBuiltIn = true);
  
  // Load custom themes asynchronously
  loadCustomThemes().then(() => {
    populateThemes();
  });

  updateShapeParams();
  updateStyleParams();
  resetSpirographs();
  updateParameterVisibility(params.curveType, params.secondaryCurve);
}

function setupEventListeners() {
  const options = { signal: listenerController.signal };

  document.getElementById("fullscreenToggle")?.addEventListener("click", toggleFullscreenCanvas, options);
  document.getElementById("shuffleTheme")?.addEventListener("click", shuffleTheme, options);
  document.getElementById("savePreset")?.addEventListener("click", savePreset, options);
  document.getElementById("autoScaleBtn")?.addEventListener("click", () => {
    autoAdjustScale();
    resetSpirographs();
  }, options);

  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      applyTheme(themeSelect.value);
    }, options);
  }

  const autoPlayIntervalSlider = document.getElementById("autoPlayInterval");
  if (autoPlayIntervalSlider) {
    autoPlayIntervalSlider.addEventListener("input", () => {
      const display = document.getElementById("autoPlayInterval-value");
      if (display) {
        display.textContent = autoPlayIntervalSlider.value;
      }
      params.autoPlayInterval = parseInt(autoPlayIntervalSlider.value, 10);
      resetAutoPlayTimer();
    }, options);
  }

  const shapeParams = ["curveType", "dualCurveMode", "secondaryCurve", "dualModeType", "outerRadius", "innerRadius", "centerSize", "numPoints", "scale", "numLayers", "layerOffsetMode", "layerOffsetAmount", "reverseLayers", "m", "n1", "n2", "n3", "f1", "f2", "d1", "d2"];
  const styleParams = ["animSpeed", "trailLength", "lineWeight", "lineThinning", "baseHue", "colorSpread"];

  shapeParams.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const eventType = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(eventType, () => {
        updateShapeParams();
        resetSpirographs();
        const display = document.getElementById(id + "-value");
        if (display) {
          display.textContent = String(el.step || "").includes('.') ? parseFloat(el.value).toFixed(2) : Math.round(el.value);
        }
      }, options);
    }
  });

  styleParams.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const eventType = el.type === "checkbox" ? "change" : "input";
      el.addEventListener(eventType, () => {
        updateStyleParams();
        const display = document.getElementById(id + "-value");
        if (display) {
          display.textContent = String(el.step || "").includes('.') ? parseFloat(el.value).toFixed(2) : Math.round(el.value);
        }
      }, options);
    }
  });

  const autoPlayCheckbox = document.getElementById("autoPlay");
  if (autoPlayCheckbox) {
    autoPlayCheckbox.addEventListener("change", () => {
      updateStyleParams();
      const autoPlaySlider = document.getElementById("autoPlay-slider-container");
      if (autoPlaySlider) {
        autoPlaySlider.style.display = autoPlayCheckbox.checked ? "block" : "none";
      }
    }, options);
    const autoPlaySlider = document.getElementById("autoPlay-slider-container");
    if (autoPlaySlider) {
      autoPlaySlider.style.display = autoPlayCheckbox.checked ? "block" : "none";
    }
  }
}

function windowResized() {
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);
  clearSpirographs();
}

function resetSpirographs() {
  clearSpirographs();
  theta = 0;
  background(290, 80, 10);
}

function clearSpirographs() {
  spirographs.forEach(layer => {
    if (Array.isArray(layer)) {
      layer.forEach(buffer => {
        if (buffer && buffer.points) {
          buffer.points = [];
          buffer.head = 0;
          buffer.count = 0;
        }
      });
      layer.length = 0;
    }
  });
  spirographs.length = 0;

  // Clear trig cache to prevent memory bloat
  trigCache = { sin: {}, cos: {} };
}

function draw() {
  if (fadeState === "fading-out") {
    fadeAlpha = min(fadeAlpha + 10, 255);
    background(290, 80, 10, fadeAlpha);
    if (fadeAlpha === 255) {
      clearSpirographs();
      theta = 0;
      const choice = nextTheme;

      // Apply new params immediately, no transition
      params.curveType = choice.curveType || "hypotrochoid";
      params.dualCurveMode = !!choice.dual;
      params.secondaryCurve = choice.secondary || "hypotrochoid";
      params.dualModeType = choice.dualMode || "blend";
      params.outerRadius = choice.outer ?? 180;
      params.innerRadius = choice.inner ?? 80;
      params.centerSize = choice.center ?? 60;
      params.numPoints = choice.points ?? 12;
      params.scale = choice.scale ?? 1.0;
      params.numLayers = choice.layers ?? 2;
      params.layerOffsetMode = choice.offset || "radius";
      params.layerOffsetAmount = choice.offsetAmount ?? 0.06;
      params.reverseLayers = !!choice.reverse;
      params.animSpeed = choice.speed ?? 0.02;
      params.trailLength = choice.trail ?? 120;
      params.lineWeight = choice.lineWeight ?? 1.6;
      params.lineThinning = choice.lineThinning ?? 0.7;
      params.baseHue = choice.hue ?? 260;
      params.colorSpread = choice.spread ?? 120;

      updateUIFromParams();
      fadeState = "fading-in";
    }
    return;
  }

  if (!params || Object.keys(params).length === 0) return;

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

  if (fadeState === "fading-in") {
    fadeAlpha = max(fadeAlpha - 10, 0);
    background(290, 80, 10, fadeAlpha);
    if (fadeAlpha === 0) {
      fadeState = "none";
    }
  }

  textFont("Splash");
  textSize(36);
  textAlign(LEFT, BOTTOM);

  // Removed expensive shadow rendering for performance
  fill(255, 64);
  text(currentThemeName, 20, height - 20);
}

function drawCurve(index, layer) {
  let outerRadius = params.outerRadius;
  let innerRadius = params.innerRadius;
  let centerSize = params.centerSize;
  let currentTheta = theta;

  // Cache these calculations
  const frameTimeKey = (frameCount * 0.002).toFixed(4);
  innerRadius += 20 * cachedSin(parseFloat(frameTimeKey) + layer * 0.4);
  centerSize += 15 * cachedCos(frameCount * 0.0015 + layer * 0.6);

  if (params.layerOffsetMode === "radius") outerRadius *= 1 + layer * params.layerOffsetAmount;
  else if (params.layerOffsetMode === "rotation") currentTheta += layer * params.layerOffsetAmount;
  else if (params.layerOffsetMode === "phase") currentTheta += layer * PI * params.layerOffsetAmount;

  if (params.reverseLayers && layer % 2 === 1) currentTheta *= -1;

  const c1 = computeCurve(params.curveType, currentTheta, outerRadius, innerRadius, centerSize);
  let x = c1.x, y = c1.y;

  if (params.dualCurveMode) {
    const c2 = computeCurve(params.secondaryCurve, currentTheta, outerRadius * 0.8, innerRadius * 0.8, centerSize * 0.8);
    if (params.dualModeType === "blend") {
      const t = cachedSin(frameCount * 0.002) * 0.5 + 0.5;
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
  if (!spirographs[index][layer]) {
    spirographs[index][layer] = {
      points: new Array(params.trailLength),
      head: 0,
      count: 0,
      maxLength: params.trailLength
    };
  }

  const buffer = spirographs[index][layer];

  // Handle trail length changes - resize buffer if needed
  if (buffer.maxLength !== params.trailLength) {
    const newPoints = new Array(params.trailLength);
    const toCopy = Math.min(buffer.count, params.trailLength);
    const start = (buffer.head - buffer.count + buffer.maxLength) % buffer.maxLength;

    for (let i = 0; i < toCopy; i++) {
      newPoints[i] = buffer.points[(start + i) % buffer.maxLength];
    }

    buffer.points = newPoints;
    buffer.head = toCopy % params.trailLength;
    buffer.count = toCopy;
    buffer.maxLength = params.trailLength;
  }

  buffer.points[buffer.head] = { x, y };
  buffer.head = (buffer.head + 1) % params.trailLength;
  if (buffer.count < params.trailLength) buffer.count++;

  if (buffer.count > 1) {
    let hue = (params.baseHue + (index * params.colorSpread / params.numPoints) + layer * 40) % 360;

    // Use beginShape/endShape for much faster line drawing
    stroke(hue, 70, 95, 85);
    strokeWeight(params.lineWeight);
    noFill();

    beginShape();
    let idx = (buffer.head - buffer.count + buffer.maxLength) % buffer.maxLength;
    for (let j = 0; j < buffer.count; j++) {
      const point = buffer.points[idx];
      if (point) {
        vertex(point.x, point.y);
      }
      idx = (idx + 1) % buffer.maxLength;
    }
    endShape();
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
    let m = params.m, n1 = params.n1, n2 = params.n2, n3 = params.n3, a = 1, b = 1;
    let part1 = pow(abs(cos((m * t) / 4) / a), n2);
    let part2 = pow(abs(sin((m * t) / 4) / b), n3);
    let denom = pow(part1 + part2, 1 / n1);
    let r = denom === 0 ? 0 : 1.0 / denom;
    x = outer * r * cos(t);
    y = outer * r * sin(t);
  } else if (type === "harmonograph") {
    let scaledT = t * 0.02;
    let A = outer * 0.5, B = inner * 0.5;
    let f1 = params.f1, f2 = params.f2, d1 = params.d1, d2 = params.d2;
    x = A * sin(f1 * scaledT + 0.5) * exp(-d1 * scaledT);
    y = B * sin(f2 * scaledT) * exp(-d2 * scaledT);
  } else if (type === "hypocycloid") {
    x = (outer - inner) * cos(t) + inner * cos(((outer - inner) / inner) * t);
    y = (outer - inner) * sin(t) - inner * sin(((outer - inner) / inner) * t);
  } else if (type === "epicycloid") {
    x = (outer + inner) * cos(t) - inner * cos(((outer + inner) / inner) * t);
    y = (outer + inner) * sin(t) - inner * sin(((outer + inner) / inner) * t);
  } else if (type === "cycloid") {
    x = inner * (t - sin(t));
    y = inner * (1 - cos(t));
  } else if (type === "trochoid") {
    x = inner * t - center * sin(t);
    y = inner - center * cos(t);
  } else if (type === "limacon") {
    let r = outer + inner * cos(t);
    x = r * cos(t);
    y = r * sin(t);
  } else if (type === "ellipse") {
    x = outer * cos(t);
    y = inner * sin(t);
  } else if (type === "butterfly") {
    let scale = outer / 40;
    t *= 2;
    let p = (exp(cos(t)) - 2 * cos(4 * t) - pow(sin(t / 12), 5));
    x = sin(t) * p * scale * 8;
    y = -cos(t) * p * scale * 8;
  } else if (type === "astroid") {
    x = outer * pow(cos(t), 3);
    y = outer * pow(sin(t), 3);
  } else if (type === "bicorn") {
    x = outer * cos(t);
    y = outer * (pow(sin(t), 2)) / (2 + sin(t));
  } else if (type === "freeth's nephroid") {
    let k = inner / outer;
    x = outer * (1 + k * sin(t/2)) * cos(t);
    y = outer * (k + sin(t/2)) * sin(t);
  } else if (type === "cardioid") {
    let a = outer / 4;
    x = a * (2 * cos(t) - cos(2*t));
    y = a * (2 * sin(t) - sin(2*t));
  }
  return { x, y };
}

function updateShapeParams() {
  currentThemeName = "Custom";
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

  params.m = parseFloat(get("m")?.value || 6);
  params.n1 = parseFloat(get("n1")?.value || 0.3);
  params.n2 = parseFloat(get("n2")?.value || 1.7);
  params.n3 = parseFloat(get("n3")?.value || 1.7);

  params.f1 = parseFloat(get("f1")?.value || 2);
  params.f2 = parseFloat(get("f2")?.value || 3);
  params.d1 = parseFloat(get("d1")?.value || 0.0006);
  params.d2 = parseFloat(get("d2")?.value || 0.0008);

  updateParameterVisibility(params.curveType, params.secondaryCurve);
}

function updateStyleParams() {
  currentThemeName = "Custom";
  const get = id => document.getElementById(id);
  params.animSpeed = parseFloat(get("animSpeed")?.value || 0.02);
  params.trailLength = parseInt(get("trailLength")?.value || 120, 10);
  params.lineWeight = parseFloat(get("lineWeight")?.value || 1.6);
  params.lineThinning = parseFloat(get("lineThinning")?.value || 0.7);
  params.baseHue = parseFloat(get("baseHue")?.value || 260);
  params.colorSpread = parseFloat(get("colorSpread")?.value || 120);
  params.autoPlay = get("autoPlay")?.checked || false;
  params.autoPlayInterval = parseInt(get("autoPlayInterval")?.value || 5, 10);

  const autoPlayIntervalDisplay = document.getElementById("autoPlayInterval-value");
  if (autoPlayIntervalDisplay) {
    autoPlayIntervalDisplay.textContent = params.autoPlayInterval;
  }

  resetAutoPlayTimer();
}

function resetAutoPlayTimer() {
  if (autoPlayTimer) clearInterval(autoPlayTimer);

  if (params.autoPlay) {
    autoPlayCountdown = params.autoPlayInterval;
    updateCountdown();

    autoPlayTimer = setInterval(() => {
      autoPlayCountdown--;
      updateCountdown();

      if (autoPlayCountdown <= 0) {
        randomizeParameters();
        autoPlayCountdown = params.autoPlayInterval;
      }
    }, 1000);
  } else {
    const countdownDisplay = document.getElementById("autoPlayCountdown");
    if (countdownDisplay) {
      countdownDisplay.textContent = "--";
    }
  }
}

function updateCountdown() {
  const countdownDisplay = document.getElementById("autoPlayCountdown");
  if (countdownDisplay) {
    countdownDisplay.textContent = autoPlayCountdown;
  }
}

function updateUIFromParams() {
  const get = id => document.getElementById(id);
  get("curveType").value = params.curveType;
  get("dualCurveMode").checked = params.dualCurveMode;
  get("secondaryCurve").value = params.secondaryCurve;
  get("dualModeType").value = params.dualModeType;

  get("outerRadius").value = params.outerRadius;
  get("innerRadius").value = params.innerRadius;
  get("centerSize").value = params.centerSize;
  get("numPoints").value = params.numPoints;
  get("scale").value = params.scale;
  get("numLayers").value = params.numLayers;
  get("layerOffsetMode").value = params.layerOffsetMode;
  get("layerOffsetAmount").value = params.layerOffsetAmount;
  get("reverseLayers").checked = params.reverseLayers;

  get("animSpeed").value = params.animSpeed;
  get("trailLength").value = params.trailLength;
  get("lineWeight").value = params.lineWeight;
  get("lineThinning").value = params.lineThinning;
  get("baseHue").value = params.baseHue;
  get("colorSpread").value = params.colorSpread;

  document.querySelectorAll("input[type=range]").forEach(input => {
    const display = document.getElementById(input.id + "-value");
    if (display) {
      display.textContent = String(input.step || "").includes('.') ? parseFloat(input.value).toFixed(2) : Math.round(input.value);
    }
  });
}

function updateParameterVisibility(primaryCurveType, secondaryCurveType) {
  const controls = {
    outerRadius: document.getElementById("outerRadius").parentElement,
    innerRadius: document.getElementById("innerRadius").parentElement,
    centerSize: document.getElementById("centerSize").parentElement,
    superformula: document.getElementById("superformula-controls"),
    harmonograph: document.getElementById("harmonograph-controls")
  };

  const visibility = {
    hypotrochoid: ["outerRadius", "innerRadius", "centerSize"],
    epitrochoid: ["outerRadius", "innerRadius", "centerSize"],
    rose: ["outerRadius", "innerRadius"],
    lissajous: ["outerRadius", "innerRadius", "centerSize"],
    superformula: ["outerRadius", "superformula"],
    harmonograph: ["outerRadius", "innerRadius", "harmonograph"],
    hypocycloid: ["outerRadius", "innerRadius"],
    epicycloid: ["outerRadius", "innerRadius"],
    cycloid: ["innerRadius"],
    trochoid: ["innerRadius", "centerSize"],
    limacon: ["outerRadius", "innerRadius"],
    ellipse: ["outerRadius", "innerRadius"],
    butterfly: ["outerRadius"],
    astroid: ["outerRadius"],
    bicorn: ["outerRadius"],
    "freeth's nephroid": ["outerRadius", "innerRadius"],
    cardioid: ["outerRadius"]
  };

  const primaryVisibility = visibility[primaryCurveType] || [];
  const secondaryVisibility = document.getElementById("dualCurveMode").checked && visibility[secondaryCurveType] ? visibility[secondaryCurveType] : [];

  Object.keys(controls).forEach(key => {
    if (primaryVisibility.includes(key) || secondaryVisibility.includes(key)) {
      controls[key].style.display = "block";
    } else {
      controls[key].style.display = "none";
    }
  });
}

function autoAdjustScale() {
  let maxRadius = 0;
  const { curveType, outerRadius, innerRadius, centerSize } = params;

  if (curveType === "hypotrochoid") {
    maxRadius = outerRadius - innerRadius + centerSize;
  } else if (curveType === "epitrochoid") {
    maxRadius = outerRadius + innerRadius + centerSize;
  } else if (curveType === "rose") {
    maxRadius = outerRadius;
  } else if (curveType === "lissajous") {
    maxRadius = max(outerRadius, innerRadius);
  } else if (curveType === "superformula") {
    maxRadius = outerRadius;
  } else if (curveType === "harmonograph") {
    maxRadius = outerRadius * 0.5 + innerRadius * 0.5;
  } else if (curveType === "hypocycloid") {
    maxRadius = outerRadius;
  } else if (curveType === "epicycloid") {
    maxRadius = outerRadius + 2 * innerRadius;
  } else if (curveType === "cycloid") {
    maxRadius = 2 * innerRadius;
  } else if (curveType === "trochoid") {
    maxRadius = innerRadius + centerSize;
  } else if (curveType === "limacon") {
    maxRadius = outerRadius + innerRadius;
  } else if (curveType === "ellipse") {
    maxRadius = max(outerRadius, innerRadius);
  } else if (curveType === "butterfly") {
    maxRadius = outerRadius;
  } else if (curveType === "astroid") {
    maxRadius = outerRadius;
  } else if (curveType === "bicorn") {
    maxRadius = outerRadius;
  } else if (curveType === "freeth's nephroid") {
    maxRadius = outerRadius + innerRadius;
  } else if (curveType === "cardioid") {
    maxRadius = outerRadius;
  }

  if (maxRadius > 0) {
    const maxAllowedRadius = min(width, height) / 2;
    const newScale = (maxAllowedRadius / maxRadius) * AUTOSCALE_PADDING;
    params.scale = newScale;
    document.getElementById("scale").value = newScale;
    const display = document.getElementById("scale-value");
    if (display) {
      display.textContent = newScale.toFixed(2);
    }
  }
}

async function loadCustomThemes() {
  // Wait for Firestore to be ready (with timeout)
  let attempts = 0;
  while (!window.firestoreReady && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!window.firestoreReady) {
    console.warn("Firestore not ready, loading local themes only");
    try {
      const localThemes = JSON.parse(localStorage.getItem("spiro_custom_themes") || "[]");
      window.themes = [...window.themes, ...localThemes];
    } catch (e) {
      console.warn("Failed to load local themes:", e);
    }
    return;
  }
  
  try {
    // Import Firestore functions
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
    
    // Get all community themes from Firebase
    const querySnapshot = await getDocs(collection(window.firestore, "themes"));
    const communityThemes = [];
    
    querySnapshot.forEach((doc) => {
      const theme = doc.data();
      theme.id = doc.id;
      theme.isCommunity = true;
      communityThemes.push(theme);
    });
    
    console.log(`Loaded ${communityThemes.length} community themes from Firebase`);
    
    // Also load user's local themes
    const localThemes = JSON.parse(localStorage.getItem("spiro_custom_themes") || "[]");
    
    // Combine built-in, local, and community themes
    window.themes = [...window.themes, ...localThemes, ...communityThemes];
  } catch (err) {
    console.warn("Failed to load community themes:", err);
    // Fallback to local themes only
    try {
      const localThemes = JSON.parse(localStorage.getItem("spiro_custom_themes") || "[]");
      window.themes = [...window.themes, ...localThemes];
    } catch (e) {
      console.warn("Failed to load local themes:", e);
    }
  }
}

function saveCustomThemes() {
  try {
    const customThemes = window.themes.filter(theme => !theme.isBuiltIn && !theme.isCommunity);
    localStorage.setItem("spiro_custom_themes", JSON.stringify(customThemes));
  } catch (err) {
    console.warn("Failed to save custom themes:", err);
  }
}

function populateThemes() {
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    const currentVal = themeSelect.value;
    themeSelect.innerHTML = "";

    const customOption = document.createElement("option");
    customOption.value = "Custom";
    customOption.textContent = "Custom";
    themeSelect.appendChild(customOption);

    window.themes.forEach(theme => {
      const option = document.createElement("option");
      option.value = theme.name;
      option.textContent = theme.name + (theme.isCommunity ? " 🌐" : "");
      themeSelect.appendChild(option);
    });

    themeSelect.value = currentVal;
  }
}

function applyTheme(themeName) {
  if (themeName === "Custom") {
    currentThemeName = "Custom";
    return;
  }
  const theme = window.themes.find(t => t.name === themeName);
  if (theme) {
    nextTheme = theme;
    currentThemeName = theme.name;
    resetSpirographs();
    fadeState = "fading-out";
  }
}

async function savePreset() {
  const name = prompt("Enter a name for your preset:");
  if (!name) return;
  
  const saveType = confirm(
    "OK = Save for everyone to see (Community)\n" +
    "Cancel = Save locally only (Just for you)"
  );
  
  const newPreset = {
    name: name,
    curveType: params.curveType,
    dual: params.dualCurveMode,
    secondary: params.secondaryCurve,
    dualMode: params.dualModeType,
    outer: params.outerRadius,
    inner: params.innerRadius,
    center: params.centerSize,
    points: params.numPoints,
    scale: params.scale,
    layers: params.numLayers,
    offset: params.layerOffsetMode,
    offsetAmount: params.layerOffsetAmount,
    reverse: params.reverseLayers,
    speed: params.animSpeed,
    trail: params.trailLength,
    lineWeight: params.lineWeight,
    lineThinning: params.lineThinning,
    hue: params.baseHue,
    spread: params.colorSpread,
    m: params.m,
    n1: params.n1,
    n2: params.n2,
    n3: params.n3,
    f1: params.f1,
    f2: params.f2,
    d1: params.d1,
    d2: params.d2,
    createdAt: new Date().toISOString()
  };
  
  if (saveType) {
    // Save to Firebase (community)
    try {
      const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
      
      const docRef = await addDoc(collection(window.firestore, "themes"), newPreset);
      newPreset.id = docRef.id;
      newPreset.isCommunity = true;
      
      window.themes.push(newPreset);
      populateThemes();
      
      const themeSelect = document.getElementById("themeSelect");
      if (themeSelect) {
        themeSelect.value = name;
      }
      
      alert(`Preset '${name}' saved and shared with the community! 🎉`);
      console.log("Community preset saved:", newPreset);
    } catch (err) {
      console.error("Failed to save to Firebase:", err);
      alert("Failed to save community preset. Try saving locally instead.");
    }
  } else {
    // Save locally only
    newPreset.isBuiltIn = false;
    
    try {
      const localThemes = JSON.parse(localStorage.getItem("spiro_custom_themes") || "[]");
      localThemes.push(newPreset);
      localStorage.setItem("spiro_custom_themes", JSON.stringify(localThemes));
      
      window.themes.push(newPreset);
      populateThemes();
      
      const themeSelect = document.getElementById("themeSelect");
      if (themeSelect) {
        themeSelect.value = name;
      }
      
      alert(`Preset '${name}' saved locally!`);
      console.log("Local preset saved:", newPreset);
    } catch (err) {
      console.error("Failed to save locally:", err);
      alert("Failed to save preset.");
    }
  }
}

let nextTheme = null;
let currentThemeName = "";

function shuffleTheme() {
  if (!Array.isArray(window.themes) || window.themes.length === 0) return;
  if (fadeState !== "none") return;
  nextTheme = window.themes[Math.floor(Math.random() * window.themes.length)];
  currentThemeName = nextTheme.name;
  resetSpirographs();
  fadeState = "fading-out";
}

function toggleFullscreenCanvas() {
  const container = document.getElementById("canvas-container");
  const controls = document.getElementById("controls");
  const button = document.getElementById("fullscreenToggle");

  if (!document.fullscreenElement) {
    container?.requestFullscreen().then(() => {
      fullscreenMode = true;
      if (controls) controls.style.display = "none";
      if (button) button.innerHTML = "&#x2715;";
      const { w, h } = getCanvasSize();
      resizeCanvas(w, h);
      clearSpirographs();
    });
  } else {
    document.exitFullscreen().then(() => {
      fullscreenMode = false;
      if (controls) controls.style.display = "block";
      if (button) button.innerHTML = "&#x26F6;";
      const { w, h } = getCanvasSize();
      resizeCanvas(w, h);
      clearSpirographs();
    });
  }
}

document.addEventListener("fullscreenchange", () => {
  const controls = document.getElementById("controls");
  const button = document.getElementById("fullscreenToggle");
  fullscreenMode = !!document.fullscreenElement;
  if (controls) controls.style.display = fullscreenMode ? "none" : "block";
  if (button) {
    button.style.display = "block";
    button.innerHTML = fullscreenMode ? "&#x2715;" : "&#x26F6;";
  }
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);
  clearSpirographs();
});