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
  to[paramName] =
