let params = {};
let spirographs = [];
let theta = 0;
let fullscreenMode = false;
let canvasEl = null;
let themeTransition = null;
let fadeState = "none"; // "none", "fading-out", "fading-in"
let fadeAlpha = 0;
let autoPlayTimer = null;
let autoPlayCountdown = 0;
let customFont = null;

function preload() {
  // Load Peckham Press font locally
  customFont = loadFont('peckham-press.otf');
}

function randomizeParameters() {
  // Randomly select curve types
  const curveTypes = ["hypotrochoid", "epitrochoid", "rose", "lissajous", "superformula", "harmonograph", "hypocycloid", "epicycloid", "cycloid", "trochoid", "limacon", "ellipse"];
  const primaryCurve = curveTypes[Math.floor(Math.random() * curveTypes.length)];
  const secondaryCurve = curveTypes[Math.floor(Math.random() * curveTypes.length)];
  
  currentThemeName = "Random";
  
  nextTheme = {
    name: "Random",
    curveType: primaryCurve,
    dual: Math.random() > 0.6, // 40% chance of dual mode
    secondary: secondaryCurve,
    dualMode: ["blend", "combine", "alternate"][Math.floor(Math.random() * 3)],
    outer: Math.floor(Math.random() * 280) + 80, // 80-360
    inner: Math.floor(Math.random() * 200) + 20, // 20-220
    center: Math.floor(Math.random() * 200) + 20, // 20-220
    points: Math.floor(Math.random() * 48) + 4, // 4-52
    scale: Math.random() * 1.5 + 0.3, // 0.3-1.8
    layers: Math.floor(Math.random() * 6) + 1, // 1-7
    offset: ["radius", "rotation", "phase"][Math.floor(Math.random() * 3)],
    offsetAmount: Math.random() * 0.5 + 0.02, // 0.02-0.52
    reverse: Math.random() > 0.5,
    speed: Math.random() * 0.035 + 0.005, // 0.005-0.04
    trail: Math.floor(Math.random() * 300) + 30, // 30-330
    lineWeight: Math.random() * 4 + 0.5, // 0.5-4.5
    lineThinning: Math.random() * 0.9 + 0.1, // 0.1-1.0
    hue: Math.floor(Math.random() * 360), // 0-360
    spread: Math.floor(Math.random() * 300) + 30, // 30-330
    // Superformula params
    m: Math.random() * 18 + 1, // 1-19
    n1: Math.random() * 8 + 0.2, // 0.2-8.2
    n2: Math.random() * 8 + 0.2, // 0.2-8.2
    n3: Math.random() * 8 + 0.2, // 0.2-8.2
    // Harmonograph params
    f1: Math.random() * 9 + 0.5, // 0.5-9.5
    f2: Math.random() * 9 + 0.5, // 0.5-9.5
    d1: Math.random() * 0.005 + 0.0001, // 0.0001-0.0051
    d2: Math.random() * 0.005 + 0.0001 // 0.0001-0.0051
  };
  
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
  fadeAlpha = 0; // Initialize fade alpha

  document.getElementById("fullscreenToggle")?.addEventListener("click", toggleFullscreenCanvas);
  document.getElementById("shuffleTheme")?.addEventListener("click", shuffleTheme);

  const autoPlayIntervalSlider = document.getElementById("autoPlayInterval");
  if (autoPlayIntervalSlider) {
    autoPlayIntervalSlider.addEventListener("input", () => {
      const display = document.getElementById("autoPlayInterval-value");
      if (display) {
        display.textContent = autoPlayIntervalSlider.value;
      }
      params.autoPlayInterval = parseInt(autoPlayIntervalSlider.value, 10);
      resetAutoPlayTimer();
    });
  }

  const shapeParams = ["curveType", "dualCurveMode", "secondaryCurve", "dualModeType", "outerRadius", "innerRadius", "centerSize", "numPoints", "scale", "numLayers", "layerOffsetMode", "layerOffsetAmount", "reverseLayers", "autoScale", "m", "n1", "n2", "n3", "f1", "f2", "d1", "d2"];
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
      });
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
      });
    }
  });

  // Add specific listener for autoPlay checkbox
  const autoPlayCheckbox = document.getElementById("autoPlay");
  if (autoPlayCheckbox) {
    autoPlayCheckbox.addEventListener("change", () => {
      updateStyleParams();
    });
  }

  updateShapeParams();
  updateStyleParams();
  resetSpirographs();
  updateParameterVisibility(params.curveType, params.secondaryCurve);
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
  if (fadeState === "fading-out") {
    fadeAlpha = min(fadeAlpha + 10, 255);
    background(290, 80, 10, fadeAlpha);
    if (fadeAlpha === 255) {
      resetSpirographs();
      const choice = nextTheme;
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
      fadeState = "fading-in";
    }
    return;
  }

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
    if (t >= 1) {
      themeTransition = null;
      updateUIFromParams();
    }
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

  if (fadeState === "fading-in") {
    fadeAlpha = max(fadeAlpha - 10, 0);
    background(290, 80, 10, fadeAlpha);
    if (fadeAlpha === 0) {
      fadeState = "none";
    }
  }

  // Draw theme name with custom styling
  if (customFont) {
    textFont(customFont);
    textSize(24);
    textAlign(LEFT, BOTTOM);
    
    // Add a subtle glow effect
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = 'rgba(255, 108, 255, 0.6)';
    
    fill(255, 200);
    text(currentThemeName, 20, height - 20);
    
    // Reset shadow
    drawingContext.shadowBlur = 0;
  } else {
    // Fallback if font doesn't load
    textSize(12);
    textAlign(LEFT, BOTTOM);
    fill(255);
    text(currentThemeName, 10, height - 10);
  }
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

  if (get("autoScale")?.checked) {
    autoAdjustScale();
  }

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
    updateCountdown(); // Show initial countdown immediately
    
    autoPlayTimer = setInterval(() => {
      autoPlayCountdown--;
      updateCountdown();
      
      if (autoPlayCountdown <= 0) {
        randomizeParameters();
        autoPlayCountdown = params.autoPlayInterval; // Reset for next cycle
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
    ellipse: ["outerRadius", "innerRadius"]
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
  }

  if (maxRadius > 0) {
    const maxAllowedRadius = min(width, height) / 2;
    const newScale = maxAllowedRadius / maxRadius;
    params.scale = newScale;
    document.getElementById("scale").value = newScale;
    const display = document.getElementById("scale-value");
    if (display) {
      display.textContent = newScale.toFixed(2);
    }
  }
}

let nextTheme = null;
let currentThemeName = "";

function shuffleTheme() {
  if (!Array.isArray(window.themes) || window.themes.length === 0) return;
  nextTheme = window.themes[Math.floor(Math.random() * window.themes.length)];
  currentThemeName = nextTheme.name;
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
      resetSpirographs();
    });
  } else {
    document.exitFullscreen().then(() => {
      fullscreenMode = false;
      if (controls) controls.style.display = "block";
      if (button) button.innerHTML = "&#x26F6;";
      const { w, h } = getCanvasSize();
      resizeCanvas(w, h);
      resetSpirographs();
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
  resetSpirographs();
});
