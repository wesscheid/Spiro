let parameterManager;
let spirographs = [];
let theta = 0;
let renderer;
let orrery;
let signature;
let fullscreenMode = false;
let canvasEl = null;
let themeTransition = null;
let fadeState = "none";
let fadeAlpha = 0;
let autoPlayTimer = null;
let autoPlayCountdown = 0;
let listenerController = new AbortController();
let capturer = null;
let isRecording = false;
let logoImage;

class SpiroRenderer {
    constructor(parameterManager) {
        this.parameterManager = parameterManager;
        this.spirographs = [];
        this.theta = 0;
    }

    reset() {
        this.clear();
        this.theta = 0;
        clear(); // Use clear() to make the canvas transparent
    }

    clear() {
        this.spirographs.forEach(layer => {
            if (Array.isArray(layer)) {
                layer.forEach(buffer => {
                    if (buffer && buffer.points) {
                        buffer.points = [];
                        buffer.head = 0;
                    }
                });
                layer.length = 0;
            }
        });
        this.spirographs.length = 0;
    }

    draw() {
        const { state } = this.parameterManager;
        if (!state) return;

        push();
        translate(width / 2, height / 2);
        scale(state.scale);
        let drift = radians(0.01 * frameCount);

        for (let i = 0; i < state.numPoints; i++) {
            push();
            rotate((i * TWO_PI) / state.numPoints + drift);
            for (let l = 0; l < state.numLayers; l++) {
                this._drawCurve(i, l);
            }
            pop();
        }
        pop();

        this.theta += state.animSpeed;
    }

    _drawCurve(index, layer) {
        const { state } = this.parameterManager;
        let { outerRadius, innerRadius, centerSize } = state;
        let currentTheta = this.theta;

        innerRadius += 20 * sin((frameCount * 0.002) + layer * 0.4);
        centerSize += 15 * cos(frameCount * 0.0015 + layer * 0.6);

        if (state.layerOffsetMode === "radius") outerRadius *= 1 + layer * state.layerOffsetAmount;
        else if (state.layerOffsetMode === "rotation") currentTheta += layer * state.layerOffsetAmount;
        else if (state.layerOffsetMode === "phase") currentTheta += layer * PI * state.layerOffsetAmount;

        if (state.reverseLayers && layer % 2 === 1) currentTheta *= -1;

        const c1 = computeCurve(state.curveType, currentTheta, outerRadius, innerRadius, centerSize);
        let { x, y } = c1;

        if (state.dualCurveMode) {
            const c2 = computeCurve(state.secondaryCurve, currentTheta, outerRadius * 0.8, innerRadius * 0.8, centerSize * 0.8);
            if (state.dualModeType === "blend") {
                const t = sin(frameCount * 0.002) * 0.5 + 0.5;
                x = lerp(c1.x, c2.x, t);
                y = lerp(c1.y, c2.y, t);
            } else if (state.dualModeType === "combine") {
                x = c1.x + c2.x;
                y = c1.y + c2.y;
            } else if (state.dualModeType === "alternate" && layer % 2 === 1) {
                x = c2.x;
                y = c2.y;
            }
        }

        if (!this.spirographs[index]) this.spirographs[index] = [];
        if (!this.spirographs[index][layer]) {
            // Create a buffer with the maximum possible size ONCE.
            this.spirographs[index][layer] = {
                points: new Array(400),
                head: 0,
            };
        }

        const buffer = this.spirographs[index][layer];
        
        // Write the new point to the physical buffer.
        buffer.points[buffer.head] = { x, y };
        buffer.head = (buffer.head + 1) % 400;

        const numToDraw = Math.floor(state.trailLength);

        if (numToDraw > 1) {
            let currentHue = state.baseHue;
            let currentSaturation = 70; // Keeping these fixed for now as per original
            let currentBrightness = 95; // Keeping these fixed for now as per original
            let currentAlpha = 85;    // Keeping these fixed for now as per original

            switch (state.colorMode) {
                case "byPoint":
                    // High contrast: Step by spread + fixed offset instead of distributing spread
                    currentHue = (state.baseHue + (index * (state.colorSpread + 45))) % 360;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    noFill();
                    break;
                case "byLayer":
                    // High contrast: Step by spread + large offset (135deg) for distinct bands
                    currentHue = (state.baseHue + (layer * (state.colorSpread + 135))) % 360;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    noFill();
                    break;
                case "gradient":
                    // Stroke will be set per segment within the loop
                    noFill();
                    break;
                case "mono":
                    currentHue = state.baseHue;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    noFill();
                    break;
                case "rainbow":
                    currentHue = (state.baseHue + (index * state.colorSpread / state.numPoints) + layer * 40) % 360;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    noFill();
                    break;
            }

            const minWeight = state.lineWeight * (1 - state.lineThinning);

            // Backtrack from the head to draw the trail.
            for (let j = 0; j < numToDraw - 1; j++) {
                const p1_idx = (buffer.head - 1 - j + 400) % 400;
                const p2_idx = (buffer.head - 2 - j + 400) % 400;
                
                const p1 = buffer.points[p1_idx];
                const p2 = buffer.points[p2_idx];

                if (p1 && p2) {
                    const progress = (numToDraw - 1 - j) / (numToDraw - 1);
                    const weight = lerp(minWeight, state.lineWeight, progress);
                    strokeWeight(weight);

                    if (state.colorMode === "gradient") {
                        currentHue = (state.baseHue + (progress * state.colorSpread)) % 360;
                        stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    }
                    line(p1.x, p1.y, p2.x, p2.y);
                }
            }
        }
    }
}

class Orrery {
    constructor(parameterManager, renderer) {
        this.parameterManager = parameterManager;
        this.renderer = renderer;
        this.dragState = null; // 'outer', 'inner', 'pen', or null
        this.hoverState = null;
    }

    getComponentPositions() {
        const { state } = this.parameterManager;
        const theta = this.renderer.theta;
        const R = state.outerRadius;
        const r = state.innerRadius;
        const d = state.centerSize;

        let innerX, innerY;
        if (state.curveType.startsWith("epi")) {
            innerX = (R + r) * cos(theta);
            innerY = (R + r) * sin(theta);
        } else { // hypo
            innerX = (R - r) * cos(theta);
            innerY = (R - r) * sin(theta);
        }

        let angle = ((R - r) / r) * theta;
        if (state.curveType.startsWith("epi")) {
           angle = ((R + r) / r) * theta;
        }

        // Subtract sin because y-axis is inverted in p5 relative to standard cartesian
        const penX = innerX + d * cos(angle);
        const penY = innerY - d * sin(angle);

        return { innerX, innerY, penX, penY };
    }

    // Convert screen coordinates (mouse) to canvas space (taking translate/scale into account)
    toCanvasSpace(mx, my) {
        const { state } = this.parameterManager;
        const centeredX = mx - width / 2;
        const centeredY = my - height / 2;
        return {
            x: centeredX / state.scale,
            y: centeredY / state.scale
        };
    }

    checkHover(mx, my) {
        if (this.dragState) return; // Don't change hover while dragging

        const { state } = this.parameterManager;
        const pos = this.toCanvasSpace(mx, my);
        const comps = this.getComponentPositions();
        const distFromCenter = dist(0, 0, pos.x, pos.y);
        const distFromInner = dist(comps.innerX, comps.innerY, pos.x, pos.y);
        const distFromPen = dist(comps.penX, comps.penY, pos.x, pos.y);

        // Thresholds for detection (scaled relative to view, but here we work in unscaled logic coords)
        const hitBuffer = 10 / state.scale; 

        if (distFromPen < 15 / state.scale) {
            this.hoverState = 'pen';
        } else if (Math.abs(distFromInner - state.innerRadius) < hitBuffer) {
            this.hoverState = 'inner';
        } else if (Math.abs(distFromCenter - state.outerRadius) < hitBuffer) {
            this.hoverState = 'outer';
        } else {
            this.hoverState = null;
        }
    }

    handlePress(mx, my) {
        this.checkHover(mx, my);
        if (this.hoverState) {
            this.dragState = this.hoverState;
            return true; // Captured
        }
        return false;
    }

    handleDrag(mx, my) {
        if (!this.dragState) return;

        const { state } = this.parameterManager;
        const pos = this.toCanvasSpace(mx, my);
        const comps = this.getComponentPositions();

        if (this.dragState === 'outer') {
            const newRadius = dist(0, 0, pos.x, pos.y);
            state.outerRadius = Math.max(10, Math.min(400, newRadius));
        } else if (this.dragState === 'inner') {
            // Distance from the *current* center of the inner circle
            const newRadius = dist(comps.innerX, comps.innerY, pos.x, pos.y);
            state.innerRadius = Math.max(5, Math.min(300, newRadius));
        } else if (this.dragState === 'pen') {
            // Distance from the center of the inner circle to mouse
            const newOffset = dist(comps.innerX, comps.innerY, pos.x, pos.y);
            state.centerSize = Math.max(0, Math.min(300, newOffset));
        }

        this.parameterManager.updateUIFromState();
        // We don't reset the renderer here to allow for smooth live-adjustment effect
        // But we might want to if the trails get messy. 
        // For now, let's reset to keep it clean.
        this.renderer.reset(); 
    }

    handleRelease() {
        this.dragState = null;
    }

    draw() {
        const { state } = this.parameterManager;
        
        // Only draw for trochoid-based curves
        const supportedCurves = ["hypotrochoid", "epitrochoid", "hypocycloid", "epicycloid"];
        if (!supportedCurves.includes(state.curveType)) {
            return;
        }

        const comps = this.getComponentPositions();

        push();
        translate(width / 2, height / 2);
        scale(state.scale);

        const strokeScale = 1 / state.scale;
        strokeWeight(strokeScale);
        
        // Colors
        const colGhost = color(180, 5, 100, 20); 
        const colActive = color(25, 100, 100, 100); // Neon Orange
        const colHover = color(25, 100, 100, 50);   // Dimmer Orange

        noFill();

        // 1. Outer Circle
        if (this.dragState === 'outer' || this.hoverState === 'outer') {
            stroke(this.dragState === 'outer' ? colActive : colHover);
            strokeWeight(2 * strokeScale);
        } else {
            stroke(colGhost);
            strokeWeight(strokeScale);
        }
        circle(0, 0, state.outerRadius * 2);

        // 2. Inner Circle
        if (this.dragState === 'inner' || this.hoverState === 'inner') {
            stroke(this.dragState === 'inner' ? colActive : colHover);
            strokeWeight(2 * strokeScale);
        } else {
            stroke(colGhost);
            strokeWeight(strokeScale);
        }
        circle(comps.innerX, comps.innerY, state.innerRadius * 2);

        // 3. Arm
        stroke(25, 80, 100, 30);
        strokeWeight(strokeScale);
        line(comps.innerX, comps.innerY, comps.penX, comps.penY);
        
        // 4. Pen Tip
        if (this.dragState === 'pen' || this.hoverState === 'pen') {
            fill(this.dragState === 'pen' ? colActive : colHover);
        } else {
            fill(25, 100, 100, 80);
        }
        noStroke();
        circle(comps.penX, comps.penY, 10 * strokeScale);

        pop();
        
        // Update cursor
        if (this.hoverState || this.dragState) {
            cursor('pointer');
        } else {
            cursor('default');
        }
    }
}

// Auto-scale padding factor (0.75 = 25% padding on all sides)
const AUTOSCALE_PADDING = 0.75;

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

  nextTheme.scale = parameterManager.state.scale;

  renderer.reset();
  fadeState = "fading-out";
}

function getCanvasSize() {
  const container = document.getElementById("canvas-container");
  if (container) {
    // Use offsetWidth/Height for the actual rendered box size
    return { w: container.offsetWidth, h: container.offsetHeight };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

function setup() {
  const { w, h } = getCanvasSize();
  const c = createCanvas(w, h);
  canvasEl = c.canvas;
  c.parent("canvas-container");
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(60);
  fadeAlpha = 0;

  // Load logo asynchronously to avoid blocking if preload fails (e.g. local file CORS)
  logoImage = loadImage('logo_ws.png');

  parameterManager = new ParameterManager();
  renderer = new SpiroRenderer(parameterManager);
  orrery = new Orrery(parameterManager, renderer);
  signature = new ArtistSignature();
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

  renderer.reset();
}

function saveImage() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  saveCanvas(`spirograph_${timestamp}`, 'png');
}

function toggleRecording() {
  const captureButton = document.getElementById('captureVideoBtn');
  const videoLength = document.getElementById('videoLength').value;
  if (!isRecording) {
    // Start recording
    capturer = new CCapture({
      format: 'webm',
      framerate: 60,
      verbose: true
    });
    capturer.start();
    isRecording = true;
    captureButton.innerText = 'Recording...';
    captureButton.disabled = true;
    console.log("Recording started");
    // Stop recording after selected duration
    setTimeout(() => {
      toggleRecording();
    }, videoLength * 1000);
  } else {
    // Stop and save
    capturer.stop();
    capturer.save();
    isRecording = false;
    capturer = null;
    captureButton.innerText = 'Capture Video';
    captureButton.disabled = false;
    console.log("Recording stopped and saved");
  }
}

function applyComplexity() {
    const { state } = parameterManager;
    if (state.complexity === undefined) return;

    // This function is only called when a control is manually changed.
    // We check if the 'complexity' slider was the one changed. If not, we don't apply the logic.
    // A simple way to do this is to have a flag, but for now we will apply it on any change.
    
    const complexity = pow(state.complexity, 2);

    // Map complexity to numPoints (e.g., from 1 to 36)
    state.numPoints = Math.round(lerp(1, 36, complexity));

    // Map complexity to numLayers (e.g., from 1 to 8)
    state.numLayers = Math.round(lerp(1, 8, state.complexity));

    // Map complexity to the radius ratio.
    const baseRatio = lerp(0.25, 0.95, state.complexity);
    state.innerRadius = state.outerRadius * baseRatio;

    // We need to update the UI to reflect these derived values.
    parameterManager.updateUIFromState();
}

function setupEventListeners() {
  const options = { signal: listenerController.signal };

  document.getElementById("fullscreenToggle")?.addEventListener("click", toggleFullscreenCanvas, options);
  document.getElementById("shuffleTheme")?.addEventListener("click", shuffleTheme, options);
  document.getElementById("randomizeParams")?.addEventListener("click", randomizeParameters, options);
  document.getElementById("savePreset")?.addEventListener("click", savePreset, options);
  document.getElementById("saveImageBtn")?.addEventListener("click", saveImage, options);
  document.getElementById("captureVideoBtn")?.addEventListener("click", toggleRecording, options);
  document.getElementById("autoScaleBtn")?.addEventListener("click", () => {
    autoAdjustScale();
    renderer.reset();
  }, options);

  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      applyTheme(themeSelect.value);
    }, options);
  }
  
  // The ParameterManager now handles binding all UI controls in the panel.
  parameterManager.bindUI((changedId) => {
      if (changedId === 'complexity' || changedId === 'outerRadius') {
        applyComplexity();
      }
      renderer.reset();
      resetAutoPlayTimer();
  });
}

function windowResized() {
  // Small delay to allow flex layout to settle (especially on mobile rotation/bar toggle)
  setTimeout(() => {
    const { w, h } = getCanvasSize();
    resizeCanvas(w, h);
    renderer.clear();
  }, 100);
}



function draw() {
  // Handle theme transition fade
  if (fadeState === "fading-out") {
    fadeAlpha = min(fadeAlpha + 10, 255);
    background(224, 39, 11, fadeAlpha);
    // Draw signature unconditionally during fading-out
    if (signature) signature.draw(fadeAlpha);
    if (fadeAlpha === 255) {
      renderer.clear();
      renderer.theta = 0;
      const choice = nextTheme;

      // Apply new theme to the parameter manager's state
      const themeAdapter = {
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
        m: choice.m, n1: choice.n1, n2: choice.n2, n3: choice.n3,
        f1: choice.f1, f2: choice.f2, d1: choice.d1, d2: choice.d2,
      };

      for (const [key, value] of Object.entries(themeAdapter)) {
          if (value !== undefined && value !== null) {
              parameterManager.state[key] = value;
          }
      }

      parameterManager.updateUIFromState();
      fadeState = "fading-in";
    }
    return;
  }

    // Delegate core drawing to the renderer

    if (renderer) {

      clear();

      if(orrery && parameterManager.state.showOrrery) orrery.draw();

      renderer.draw();

    }

  // Handle fade-in after theme transition
  if (fadeState === "fading-in") {
    fadeAlpha = max(fadeAlpha - 10, 0);
    background(224, 39, 11, fadeAlpha);
    if (fadeAlpha === 0) {
      fadeState = "none";
    }
    // Draw signature unconditionally during fading-in
    if (signature) signature.draw(fadeAlpha);
    return;
  }

  // --- UI Overlays ---
  textFont("Splash");
  textSize(36);
  textAlign(LEFT, BOTTOM);
  fill(255, 64);
  text(currentThemeName, 20, height - 20);

  if (isRecording) {
    fill(255, 0, 0);
    textSize(24);
    textAlign(LEFT, TOP);
    text("REC", 20, 20);
  }

  if (isRecording && capturer) {
    capturer.capture(canvasEl);
  }
}

function computeCurve(type, t, outer, inner, center) {
  const formula = CurveFactory.getFormula(type);
  const curveParams = {
      outer: outer,
      inner: inner,
      center: center,
      m: parameterManager.state.m,
      n1: parameterManager.state.n1,
      n2: parameterManager.state.n2,
      n3: parameterManager.state.n3,
      f1: parameterManager.state.f1,
      f2: parameterManager.state.f2,
      d1: parameterManager.state.d1,
      d2: parameterManager.state.d2,
  };
  return formula(t, curveParams);
}

function mousePressed() {
    // Only interact if clicking on the canvas
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        if (orrery && parameterManager.state.showOrrery && orrery.handlePress(mouseX, mouseY)) {
            // Disable default drag behavior if we captured an object
            return false;
        }
    }
}

function mouseDragged() {
    if (orrery) {
        orrery.handleDrag(mouseX, mouseY);
        // Check hover state during drag to keep cursor updated
        orrery.checkHover(mouseX, mouseY);
    }
}

function mouseReleased() {
    if (orrery) {
        orrery.handleRelease();
    }
}

function mouseMoved() {
    if (orrery && parameterManager.state.showOrrery) {
        orrery.checkHover(mouseX, mouseY);
    } else {
        cursor('default');
    }
}

class ArtistSignature {
    draw(currentFadeAlpha) {
        if (!logoImage || logoImage.width === 0) return;

        push();
        translate(width/2, height/2);
        
        // Pulsing scale
        scale(1 + sin(frameCount * 0.1) * 0.05);
        
        imageMode(CENTER);
        tint(255, currentFadeAlpha);
        
        // Draw the logo, adjusting size as needed (e.g., 150x150)
        // We use the aspect ratio of the image to ensure it's not stretched
        let imgW = 120;
        let imgH = 120 * (logoImage.height / logoImage.width);
        image(logoImage, 0, 0, imgW, imgH);

        pop();
    }
}



function resetAutoPlayTimer() {
  if (autoPlayTimer) clearInterval(autoPlayTimer);

  if (parameterManager.state.autoPlay) {
    autoPlayCountdown = parameterManager.state.autoPlayInterval;
    updateCountdown();

    autoPlayTimer = setInterval(() => {
      autoPlayCountdown--;
      updateCountdown();

      if (autoPlayCountdown <= 0) {
        randomizeParameters();
        autoPlayCountdown = parameterManager.state.autoPlayInterval;
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



function autoAdjustScale() {
  let maxRadius = 0;
  const { curveType, outerRadius, innerRadius, centerSize } = parameterManager.state;

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
    parameterManager.state.scale = newScale;
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
    const { collection, getDocs } = window.firebaseFunctions; // Use globally exposed functions
    
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
    renderer.reset();
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
    curveType: parameterManager.state.curveType,
    dual: parameterManager.state.dualCurveMode,
    secondary: parameterManager.state.secondaryCurve,
    dualMode: parameterManager.state.dualModeType,
    outer: parameterManager.state.outerRadius,
    inner: parameterManager.state.innerRadius,
    center: parameterManager.state.centerSize,
    points: parameterManager.state.numPoints,
    scale: parameterManager.state.scale,
    layers: parameterManager.state.numLayers,
    offset: parameterManager.state.layerOffsetMode,
    offsetAmount: parameterManager.state.layerOffsetAmount,
    reverse: parameterManager.state.reverseLayers,
    speed: parameterManager.state.animSpeed,
    trail: parameterManager.state.trailLength,
    lineWeight: parameterManager.state.lineWeight,
    lineThinning: parameterManager.state.lineThinning,
    hue: parameterManager.state.baseHue,
    spread: parameterManager.state.colorSpread,
    m: parameterManager.state.m,
    n1: parameterManager.state.n1,
    n2: parameterManager.state.n2,
    n3: parameterManager.state.n3,
    f1: parameterManager.state.f1,
    f2: parameterManager.state.f2,
    d1: parameterManager.state.d1,
    d2: parameterManager.state.d2,
    createdAt: new Date().toISOString()
  };
  
  if (saveType) {
    // Save to Firebase (community)
    try {
      const { collection, addDoc } = window.firebaseFunctions; // Use globally exposed functions
      
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
  renderer.reset();
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
      renderer.clear();
    });
  } else {
    document.exitFullscreen().then(() => {
      fullscreenMode = false;
      if (controls) controls.style.display = "block";
      if (button) button.innerHTML = "&#x26F6;";
      const { w, h } = getCanvasSize();
      resizeCanvas(w, h);
      renderer.clear();
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