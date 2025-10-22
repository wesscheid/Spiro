 // spiro.js — Final version with Option 2 fix, slider patch, and full transition smoothing

let params = {
  outerRadius: 180,
  innerRadius: 80,
  centerSize: 60,
  numPoints: 12,
  scale: 1.0,
  numLayers: 2,
  layerOffsetMode: "radius",
  layerOffsetAmount: 0.06,
  reverseLayers: false,
  animSpeed: 0.04,
  trailLength: 50,
  lineWeight: 1.6,
  lineThinning: 0.7,
  baseHue: 260,
  colorSpread: 120,
};

let curveType = "hypotrochoid";
let secondaryCurve = "epitrochoid";
let dualCurveMode = false;
let dualModeType = "blend";
let themeTransition = null;
let spirographs = [];
let lastTime = 0;

// ─────────────────────────────
// SETUP + DRAW
// ─────────────────────────────

function setup() {
  const container = document.getElementById("canvas-container");
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent(container);
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(RADIANS);
  noFill();
  initSpirographs();
}

function draw() {
  background(0, 0, 0, 10);
  translate(width / 2, height / 2);
  updateTransitions();
  for (let s of spirographs) {
    s.update();
    s.display();
  }
}

// ─────────────────────────────
// INITIALIZATION / RESET
// ─────────────────────────────

function initSpirographs() {
  spirographs = [];
  for (let i = 0; i < params.numLayers; i++) {
    spirographs.push(new Spirograph({ ...params, layerIndex: i }));
  }
}

function resetSpirographs() {
  spirographs = [];
  for (let i = 0; i < params.numLayers; i++) {
    spirographs.push(new Spirograph({ ...params, layerIndex: i }));
  }
}

function updateAllParams() {
  for (let s of spirographs) {
    Object.assign(s, params);
  }
}

// ─────────────────────────────
// INPUT HANDLERS
// ─────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#controls input, #controls select").forEach((input) => {
    const valueDisplay = document.getElementById(`${input.id}-value`);
    if (valueDisplay) {
      const updateDisplay = () => {
        const value = input.value;
        const step = String(input.step || "").includes(".")
          ? parseFloat(value).toFixed(2)
          : value;
        valueDisplay.textContent = step;
      };
      updateDisplay();
      input.addEventListener("input", updateDisplay);
    }

    input.addEventListener("input", () => {
      const paramName = input.id;
      const newValue =
        input.type === "checkbox" ? input.checked : parseFloat(input.value);
      params[paramName] = newValue;

      // handle curve selection separately
      if (
        ["curveType", "secondaryCurve", "dualCurveMode", "dualModeType"].includes(
          paramName
        )
      ) {
        curveType = document.getElementById("curveType").value;
        secondaryCurve = document.getElementById("secondaryCurve").value;
        dualCurveMode = document.getElementBy
