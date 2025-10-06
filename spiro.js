let params = {};
let spirographs = [];
let theta = 0;
let fullscreenMode = false;
let canvasEl = null;
let themeTransition = null;

// The definitive list of parameters that can be smoothly transitioned without a hard reset.
// Scale is included because the draw loop scales ALL existing points in the trail, making a smooth zoom possible.
const AESTHETIC_PARAMS = ['animSpeed', 'trailLength', 'lineWeight', 'lineThinning', 'baseHue', 'colorSpread', 'scale']; 

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
  // FIX: Use the current theme's baseHue for a full, opaque background wipe
  const bgHue = params.baseHue !== undefined ? params.baseHue : 290;
  background(bgHue, 80, 10);
}

// =================================================================
// PRIMARY  LOOP LOGIC
// =================================================================

// =================================================================
// PRIMARY DRAW LOOP LOGIC (Updated)
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
  // Apply a low opacity background for the trail effect, unless trailLength is 0
  const bgAlpha = params.trailLength > 0 ? 5 : 100;
  background(params.baseHue, 80, 10, bgAlpha); 
  
  // Update theta for animation speed
  theta += params.animSpeed; 
  
  // Recalculate and draw the current frame
  drawSpirograph();

  // 3. Handle Flash Effect during Shuffle (FIXED LOGIC)
  if (params.flash > 0) {
    // We are already inside the drawing space translated to the center (width/2, height/2)
    push(); // Save the current state (translated to center)

    noStroke();
    // Fill with white (0, 0, 100) and use params.flash for alpha (0-100)
    fill(0, 0, 100, params.flash); 
    
    // Draw the rectangle centered at (0, 0) of the *translated* coordinate system
    rectMode(CENTER);
    rect(0, 0, width, height); 
    
    pop(); // Restore previous drawing state
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

  // Flash property is managed internally but needs a default value
  params.flash = 0;
}

function shuffleTheme() {
  if (!Array.isArray(window.themes) || window.themes.length === 0) return;

  // Correctly use window.themes
  const choice = window.themes[Math.floor(Math.random() * window.themes.length)];

  // 1. HARD RESET CORE LOGIC
  // These lines clear the old, incompatible trail data and reset the drawing phase.
  spirographs = []; 
  theta = 0;
  
  // 2. HARD CLEAR: Immediately wipe the screen using the new base hue.
  // This removes any lingering ghost images before the transition.
  const newHue = choice.hue ?? 260; 
  background(newHue, 80, 10);
  
  // 3. INITIATE TRANSITION (Softened Flash)
  themeTransition = {
    from: { 
      ...params,
      // FIX: Flash starts at 70% opacity (less intense)
      flash: 70 
    },
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
      colorSpread: choice.spread ?? 120,
      // Flash ends fully transparent (0)
      flash: 0 
    },
    start: millis(),
    duration: 250 // The flash fades out over 250ms
  };
}


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

  const currentTheta = theta + tOffset * (params.reverseLayers ? -1 : 1);

  let x, y, r;

  switch (curveType) {
    case "hypotrochoid":
    case "epitrochoid":
        const R = params.outerRadius + rOffset;
        const r_ = params.innerRadius;
        const d = params.centerSize;
        const sign = curveType === "hypotrochoid" ? -1 : 1;
        const k = R / r_;
        
        x = (R + sign * r_) * cos(currentTheta) - d * sign * cos(k * currentTheta + currentTheta);
        y = (R + sign * r_) * sin(currentTheta) - d * sign * sin(k * currentTheta + currentTheta);
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
        const n1 = 0.5; 
        const n2 = 1.7;
        const n3 = 1.7;
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
    
    // Choose drawing mode for dual curves
    if (params.dualCurveMode && params.dualModeType === "combine" && i > 0) continue; 
    
    // Use beginShape/endShape for continuous line drawing
    beginShape();
    for (let j = 0; j < layer.length; j++) {
      const p = layer[j];
      const t = j / layer.length; // Normalized position along the trail

      // Calculate hue and alpha
      const hue = (params.baseHue + (t * params.colorSpread * (params.reverseLayers ? -1 : 1)) + (i * 360 / params.numLayers)) % 360;
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
    endShape();
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

function getCanvasSizeFromWindow() {
  // This is used for windowResized and fullscreen logic
  const controls = document.getElementById("controls");
  const rect = controls?.getBoundingClientRect() || { width: 300, height: 300 };
  if (fullscreenMode) return { w: window.innerWidth, h: window.innerHeight };
  if (window.innerWidth <= 720) return { w: window.innerWidth, h: window.innerHeight - rect.height };
  return { w: window.innerWidth - rect.width, h: window.innerHeight };
}

window.addEventListener("resize", () => {
  const { w, h } = getCanvasSizeFromWindow();
  resizeCanvas(w, h);
  resetSpirographs();
});

document.addEventListener("fullscreenchange", () => {
  const controls = document.getElementById("controls");
  fullscreenMode = !!document.fullscreenElement;
  if (controls) controls.style.display = fullscreenMode ? "none" : "block";
  const { w, h } = getCanvasSizeFromWindow();
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
