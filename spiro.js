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
    duration: 1500
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
});
