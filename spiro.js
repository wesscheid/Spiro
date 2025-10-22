// spiro.js — Updated version with Option 2 fix and slider patch

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

// Example initialization
function setup() {
  const container = document.getElementById("canvas-container");
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent(container);
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(RADIANS);
  noFill();
  initSpirographs();
}

// Main animation loop
function draw() {
  background(0, 0, 0, 10);
  translate(width / 2, height / 2);
  for (let s of spirographs) {
    s.update();
    s.display();
  }
}

function initSpirographs() {
  spirographs = [];
  for (let i = 0; i < params.numLayers; i++) {
    spirographs.push(
      new Spirograph({
        ...params,
        layerIndex: i,
      })
    );
  }
}

// Smart reset — avoids freezes when updating geometry parameters
function resetSpirographs() {
  spirographs = [];
  for (let i = 0; i < params.numLayers; i++) {
    spirographs.push(
      new Spirograph({
        ...params,
        layerIndex: i,
      })
    );
  }
}

function updateAllParams() {
  for (let s of spirographs) {
    Object.assign(s, params);
  }
}

// Event listener setup
window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#controls input, #controls select").forEach((input) => {
    const valueDisplay = document.getElementById(`${input.id}-value`);
    if (valueDisplay) {
      const updateDisplay = () => {
        const value = input.value;
        const step = String(input.step || "").includes(".") ? parseFloat(value).toFixed(2) : value;
        valueDisplay.textContent = step;
      };
      updateDisplay();
      input.addEventListener("input", updateDisplay);
    }

    input.addEventListener("input", () => {
      const paramName = input.id;
      const newValue = input.type === "checkbox" ? input.checked : parseFloat(input.value);
      params[paramName] = newValue;

      if (["curveType", "secondaryCurve", "dualCurveMode", "dualModeType"].includes(paramName)) {
        curveType = document.getElementById("curveType").value;
        secondaryCurve = document.getElementById("secondaryCurve").value;
        dualCurveMode = document.getElementById("dualCurveMode").checked;
        dualModeType = document.getElementById("dualModeType").value;
        updateAllParams();
        resetSpirographs();
      } else if (AESTHETIC_PARAMS.includes(paramName)) {
        startParameterTransition(paramName, newValue, 300);
      } else {
        if (themeTransition) themeTransition = null; // cancel active transition (Option 2 fix)
        updateAllParams();
        resetSpirographs();
      }
    });
  });
});

const AESTHETIC_PARAMS = [
  "animSpeed",
  "trailLength",
  "lineWeight",
  "lineThinning",
  "baseHue",
  "colorSpread",
];

function startParameterTransition(param, targetValue, duration) {
  if (themeTransition) themeTransition = null;
  const startValue = params[param];
  const startTime = millis();

  themeTransition = { param, startValue, targetValue, duration, startTime };
}

function updateTransitions() {
  if (!themeTransition) return;

  const { param, startValue, targetValue, duration, startTime } = themeTransition;
  const elapsed = millis() - startTime;
  const t = constrain(elapsed / duration, 0, 1);
  params[param] = lerp(startValue, targetValue, t);
  if (t >= 1) themeTransition = null;
}

// Simplified spirograph object
class Spirograph {
  constructor(cfg) {
    Object.assign(this, cfg);
    this.angle = 0;
  }

  update() {
    this.angle += this.animSpeed;
  }

  display() {
    stroke(
      (this.baseHue + this.layerIndex * this.colorSpread) % 360,
      100,
      100,
      100
    );
    strokeWeight(this.lineWeight);
    beginShape();
    for (let i = 0; i < this.numPoints; i++) {
      const a = i * TWO_PI / this.numPoints + this.angle;
      const x = cos(a) * this.outerRadius * this.scale;
      const y = sin(a) * this.innerRadius * this.scale;
      vertex(x, y);
    }
    endShape(CLOSE);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  }
function resetSpirographs() {
  spirographs = [];
  theta = 0;
  // Use the current theme's baseHue for a full, opaque background wipe
  const bgHue = params.baseHue !== undefined ? params.baseHue : 290;
  background(bgHue, 80, 10);
}

// =================================================================
// PRIMARY DRAW LOOP LOGIC
// =================================================================

function draw() {
  if (!params || Object.keys(params).length === 0) return;

  // 1. Handle Transitions (Theme Shuffle OR Single Parameter Change)
  if (themeTransition) {
    const t = constrain((millis() - themeTransition.start) / themeTransition.duration, 0, 1);
    
    // Smoothly apply values for all parameters in the transition object
    for (const key in themeTransition.to) {
      if (typeof themeTransition.from[key] === 'number') {
        params[key] = lerp(themeTransition.from[key], themeTransition.to[key], t);
      } else {
        // Non-numeric values (like curveType) are set only when transition starts or ends
        params[key] = themeTransition.to[key];
      }
    }

    // End transition if time is up
    if (t === 1) {
      themeTransition = null;
    }
  }

  // 2. Redraw Background and Path
  const bgAlpha = params.trailLength > 0 ? 5 : 100;
  background(params.baseHue, 80, 10, bgAlpha); 
  
  // FIX: Ensure animSpeed is always at least 0.001 to guarantee movement
  theta += max(0.001, params.animSpeed); 
  
  // Recalculate and draw the current frame
  drawSpirograph();

  // 3. Handle Flash Effect during Shuffle (FIXED LOGIC)
  if (params.flash > 0) {
    push(); 
    noStroke();
    fill(0, 0, 100, params.flash); 
    rectMode(CENTER);
    rect(0, 0, width, height); 
    pop(); 
  }
}
// =================================================================
// PARAMETER/THEME LOGIC
// =================================================================

// Function to initiate a smooth transition for a single slider change
function startParameterTransition(paramName, newValue, duration = 300) {
  // Base the 'from' state on the current, live 'params' object
  const from = { ...params };
  const to = { ...params };
  
  // Set the new target value for the specific parameter
  to[paramName] = newValue;

  // Initiate the new, partial transition
  themeTransition = {
    from: from,
    to: to,
    start: millis(),
    duration: duration
  };
}

function updateAllParams() {
  // Reads ALL parameter values from the DOM and updates the 'params' object
  
  // Primary Curve
  params.curveType = document.getElementById('curveType').value;
  params.outerRadius = parseFloat(document.getElementById('outerRadius').value);
  params.innerRadius = parseFloat(document.getElementById('innerRadius').value);
  params.centerSize = parseFloat(document.getElementById('centerSize').value);
  params.numPoints = parseInt(document.getElementById('numPoints').value);

  // Dual Curve
  params.dualCurveMode = document.getElementById('dualCurveMode').checked;
  params.secondaryCurve = document.getElementById('secondaryCurve').value;
  params.dualModeType = document.getElementById('dualModeType').value;
  
  // Layers
  params.numLayers = parseInt(document.getElementById('numLayers').value);
  params.layerOffsetMode = document.getElementById('layerOffsetMode').value;
  params.layerOffsetAmount = parseFloat(document.getElementById('layerOffsetAmount').value);
  params.reverseLayers = document.getElementById('reverseLayers').checked;

  // Aesthetics & Motion
  params.scale = parseFloat(document.getElementById('scale').value);
  params.animSpeed = parseFloat(document.getElementById('animSpeed').value);
  params.trailLength = parseInt(document.getElementById('trailLength').value);
  params.lineWeight = parseFloat(document.getElementById('lineWeight').value);
  params.lineThinning = parseFloat(document.getElementById('lineThinning').value);
  params.baseHue = parseFloat(document.getElementById('baseHue').value);
  params.colorSpread = parseFloat(document.getElementById('colorSpread').value);

  // Initialize the new 'flash' parameter to ensure it exists on the 'params' object at load.
  params.flash = 0; 
}

// =================================================================
// SHUFFLE THEME FUNCTION (Fully Fixed)
// =================================================================

function shuffleTheme() {
  if (!Array.isArray(window.themes) || window.themes.length === 0) return;

  const choice = window.themes[Math.floor(Math.random() * window.themes.length)];

  // 1. HARD RESET CORE LOGIC
  // Clear the old, incompatible trail data and reset the drawing phase immediately.
  spirographs = []; 
  theta = 0;
  
  // 2. FIX: IMMEDIATELY APPLY ALL GEOMETRIC/STRUCTURAL PARAMETERS
  // These parameters MUST snap immediately for the new curve to start drawing.
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
  
  // 3. HARD CLEAR & BASE HUE SNAP
  // Apply the new background hue (and base color) immediately.
  const newHue = choice.hue ?? 260; 
  background(newHue, 80, 10);
  params.baseHue = newHue; // Ensures points start drawing with the right color
  
  // 4. INITIATE TRANSITION (ONLY for Aesthetics & Flash)
  // Only the aesthetic, color spread, and speed variables need to transition smoothly.
  themeTransition = {
    from: { 
      // Only include aesthetic and flash properties in the transition
      animSpeed: params.animSpeed,
      trailLength: params.trailLength,
      lineWeight: params.lineWeight,
      lineThinning: params.lineThinning,
      colorSpread: params.colorSpread,
      scale: params.scale, // Scale can transition smoothly
      flash: 70 // Softened Flash starts at 70% opacity
    },
    to: {
      animSpeed: choice.speed ?? 0.02,
      trailLength: choice.trail ?? 120,
      lineWeight: choice.lineWeight ?? 1.6,
      lineThinning: choice.lineThinning ?? 0.7,
      colorSpread: choice.spread ?? 120,
      scale: choice.scale ?? 1.0,
      flash: 0 // Flash ends fully transparent
    },
    start: millis(),
    duration: 250 
  };
}


// =================================================================
// GEOMETRY MATH (Spirographs)
// =================================================================

// =================================================================
// GEOMETRY MATH (Spirographs)
// =================================================================

function getPolarCoordinate(theta, layer) {
  // Helper to calculate the current coordinate based on curve type and parameters
  
  let curveType = layer % 2 === 0 ? params.curveType : params.secondaryCurve;
  if (!params.dualCurveMode) curveType = params.curveType;
  
  // Logic for layer offsets
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

  // Directional Factor logic (Applies to the time-based angle, theta)
  let directionalFactor = 1;
  if (params.reverseLayers) {
      directionalFactor = (layer % 2 === 0) ? 1 : -1;
  }
  
  // Reverse rotational offset for reversed layers
  if (directionalFactor === -1 && (params.layerOffsetMode === "rotation" || params.layerOffsetMode === "phase")) {
    tOffset *= -1;
  }
  
  // Apply the directional factor to the base angle (theta) and add the static layer offset (tOffset)
  const currentTheta = (theta * directionalFactor) + tOffset;

  let x, y, r;

  switch (curveType) {
    case "hypotrochoid":
    case "epitrochoid":
        // 1. Base Radii
        const r_ = params.innerRadius; 
        const d = params.centerSize;
        
        // 2. Apply Layer Offset to R (Outer Radius)
        let R = params.outerRadius + rOffset;

        // --- FINAL, ROBUST FIX: Prevents Hypotrochoid from collapsing to a single point. ---
        // Collapse occurs when R == r_ (R/r_ = 1), causing the rotation factor (k-1) to be 0.
        if (curveType === "hypotrochoid" && abs(R - r_) < 0.01) {
            // Force R to be 1% larger than r_ to guarantee a non-zero rotation factor (k-1 = 0.01).
            R = r_ * 1.01; 
        }
        // --- END FIX ---

        const k = R / r_; // Ratio R/r_

        // Correct angular frequency based on the curve's type: k-1 (hypo) or k+1 (epi)
        const rotationFactor = curveType === "hypotrochoid" ? (k - 1) : (k + 1);
        const secondAngle = currentTheta * rotationFactor;

        if (curveType === "hypotrochoid") {
            // Hypotrochoid: x = (R-r)cos(t) + d*cos((k-1)t), y = (R-r)sin(t) - d*sin((k-1)t)
            x = (R - r_) * cos(currentTheta) + d * cos(secondAngle);
            y = (R - r_) * sin(currentTheta) - d * sin(secondAngle);
        } else { // Epitrochoid
            // Epitrochoid: x = (R+r)cos(t) - d*cos((k+1)t), y = (R+r)sin(t) - d*sin((k+1)t)
            x = (R + r_) * cos(currentTheta) - d * cos(secondAngle);
            y = (R + r_) * sin(currentTheta) - d * sin(secondAngle);
        }
        break;

    case "rose":
        const n = params.numPoints;
        const D = params.outerRadius + rOffset;
        r = D * cos(n * currentTheta);
        x = r * cos(currentTheta);
        y = r * sin(currentTheta);
        break;

    case "lissajous":
        const freqX = params.numPoints / 2; // Simple conversion for control
        const freqY = params.numPoints / 3;
        const ampX = params.outerRadius + rOffset;
        const ampY = params.innerRadius;
        const phase = params.layerOffsetAmount * PI; // Use offset for phase
        
        x = ampX * sin(freqX * currentTheta + phase);
        y = ampY * cos(freqY * currentTheta);
        break;

    case "superformula":
        // Simplified Superformula
        const m = params.numPoints;
        const n1 = 1.0; 
        const n2 = 1.0; 
        const n3 = 1.0; 
        const a = 1;
        const b = 1;
        const phi = currentTheta;
        const t1 = (abs(cos(m * phi / 4) / a) ** n2);
        const t2 = (abs(sin(m * phi / 4) / b) ** n3);
        r = (params.outerRadius + rOffset) / ((t1 + t2) ** (1 / n1));
        
        x = r * cos(phi);
        y = r * sin(phi);
        break;
        
    case "harmonograph":
        const freq1 = params.numPoints;
        const freq2 = params.numPoints * 0.99;
        const phase1 = params.layerOffsetAmount * PI;
        const phase2 = params.layerOffsetAmount * HALF_PI;
        const damp = 0.9999;
        
        x = (params.outerRadius + rOffset) * cos(freq1 * currentTheta + phase1) * (damp ** currentTheta);
        y = (params.innerRadius) * sin(freq2 * currentTheta + phase2) * (damp ** currentTheta);
        break;
        
    default:
      x = 0; y = 0; // Fallback
  }

  // Apply overall scale
  return createVector(x * params.scale, y * params.scale);
}

function drawSpirograph() {
  noFill();
  translate(width / 2, height / 2);

  // If we are at the beginning of a drawing, initialize the spirographs array
  if (spirographs.length === 0) {
      for(let i = 0; i < params.numLayers; i++) {
          spirographs.push([]);
      }
  }

  // Get new point for each layer
  for (let i = 0; i < params.numLayers; i++) {
    const point = getPolarCoordinate(theta, i);
    spirographs[i].push(point);
  }

  // Trim trail length
  const maxLen = params.trailLength;
  for (let i = 0; i < params.numLayers; i++) {
    if (spirographs[i].length > maxLen) {
      spirographs[i].shift();
    }
  }

  // Draw all layers
  for (let i = 0; i < params.numLayers; i++) {
    const layer = spirographs[i];
    
    // FIX: begnShape()/endShape() removed to allow individual line segment styling
    for (let j = 0; j < layer.length; j++) {
      const p = layer[j];
      const t = j / layer.length; // Normalized position along the trail

      // This logic ensures the color trail also flows in the reversed direction
      let colorFactor = 1;
      if (params.reverseLayers) {
          // If 'Reverse Alternate Layers' is checked, alternate direction for the color spread
          colorFactor = (i % 2 === 0) ? 1 : -1;
      }
      
      // Calculate hue and alpha
      const hue = (params.baseHue + (t * params.colorSpread * colorFactor) + (i * 360 / params.numLayers)) % 360;
      const alpha = map(t, 0, 1, 30, 100);

      // Calculate weight with thinning effect
      const weight = map(t, 0, 1, params.lineWeight * params.lineThinning, params.lineWeight);

      // Set stroke for the segment
      stroke(hue, 80, 95, alpha);
      strokeWeight(weight);
      
      // Draw the line segment
      if (j > 0) {
          const pPrev = layer[j - 1];
          line(pPrev.x, pPrev.y, p.x, p.y); 
      }
    }
  }
}

// =================================================================
// UI INITIALIZATION AND EVENT LISTENERS
// =================================================================

function toggleFullscreenCanvas() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}

window.addEventListener("resize", () => {
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);
  resetSpirographs();
});

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
  
  // =================================================================
  // MODIFIED SLIDER EVENT LISTENER (Handles Smooth/Hard Resets)
  // =================================================================
  document.querySelectorAll("input[type=range]").forEach(input => {
    const display = document.getElementById(input.id + "-value");
    
    // Initial display value
    if (display) {
      display.textContent = String(input.step || "").includes('.') ? parseFloat(input.value).toFixed(2) : Math.round(input.value);
    }
    
    input.addEventListener("input", () => {
      // Update display value
      const display = document.getElementById(input.id + "-value");
      if (display) {
        display.textContent = String(input.step || "").includes('.') ? parseFloat(input.value).toFixed(2) : Math.round(input.value);
      }
      
      const paramName = input.id;
      const newValue = parseFloat(input.value);
      
      if (AESTHETIC_PARAMS.includes(paramName)) {
          // Soft Transition for aesthetic parameters
          startParameterTransition(paramName, newValue, 300); // 300ms transition
      } else {
          // Hard Reset for geometry-altering parameters
          updateAllParams();
          resetSpirographs();
      }
    });
  });

  // Keep the select/checkbox listeners for hard reset (geometry/logic changes)
  document.querySelectorAll("select, input[type=checkbox]").forEach(el => {
    el.addEventListener("change", () => {
      updateAllParams();
      resetSpirographs();
    });
  });

  updateAllParams();
});
