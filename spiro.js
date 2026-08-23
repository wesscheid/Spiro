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
let isPaused = false;
let logoImage;
let nextTheme = null;
let currentThemeName = "Default";

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
                    if (buffer) {
                        buffer.head = 0;
                        buffer.count = 0;
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

        // Blend mode
        if (state.blendMode) {
            drawingContext.globalCompositeOperation = state.blendMode;
        } else {
            drawingContext.globalCompositeOperation = 'source-over';
        }

        // Glow / Neon effect
        if (state.glowEffect) {
            drawingContext.shadowBlur = 14;
            drawingContext.shadowColor = `hsla(${state.baseHue}, 100%, 65%, 0.85)`;
        } else {
            drawingContext.shadowBlur = 0;
            drawingContext.shadowColor = 'transparent';
        }

        for (let i = 0; i < state.numPoints; i++) {
            push();
            rotate((i * TWO_PI) / state.numPoints + drift);
            if (state.mirrorSymmetry && i % 2 === 1) {
                scale(1, -1);
            }
            for (let l = 0; l < state.numLayers; l++) {
                this._drawCurve(i, l);
            }
            pop();
        }
        pop();

        // Reset composite & shadow for HUD overlays
        drawingContext.shadowBlur = 0;
        drawingContext.shadowColor = 'transparent';
        drawingContext.globalCompositeOperation = 'source-over';

        if (!isPaused) {
            this.theta += state.animSpeed;
        }
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
            // Pre-allocate typed arrays to eliminate GC pressure
            this.spirographs[index][layer] = {
                x: new Float32Array(400),
                y: new Float32Array(400),
                head: 0,
                count: 0
            };
        }

        const buffer = this.spirographs[index][layer];
        
        // Write the new point directly to typed buffers (0 object allocation)
        buffer.x[buffer.head] = x;
        buffer.y[buffer.head] = y;
        buffer.head = (buffer.head + 1) % 400;
        if (buffer.count < 400) buffer.count++;

        const numToDraw = Math.min(buffer.count, Math.floor(state.trailLength));

        if (numToDraw > 1) {
            let currentHue = state.baseHue;
            let currentSaturation = 70;
            let currentBrightness = 95;
            let currentAlpha = 85;

            switch (state.colorMode) {
                case "byPoint":
                    currentHue = (state.baseHue + (index * (state.colorSpread + 45))) % 360;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    noFill();
                    break;
                case "byLayer":
                    currentHue = (state.baseHue + (layer * (state.colorSpread + 135))) % 360;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                    noFill();
                    break;
                case "gradient":
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
                
                const x1 = buffer.x[p1_idx];
                const y1 = buffer.y[p1_idx];
                const x2 = buffer.x[p2_idx];
                const y2 = buffer.y[p2_idx];

                const progress = (numToDraw - 1 - j) / (numToDraw - 1);
                const weight = lerp(minWeight, state.lineWeight, progress);
                strokeWeight(weight);

                if (state.colorMode === "gradient") {
                    currentHue = (state.baseHue + (progress * state.colorSpread)) % 360;
                    stroke(currentHue, currentSaturation, currentBrightness, currentAlpha);
                }
                line(x1, y1, x2, y2);
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
  
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.value = "Custom";
  }

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
  currentThemeName = "Default";

  // Load logo asynchronously to avoid blocking if preload fails (e.g. local file CORS)
  logoImage = loadImage('logo_ws.png');

  parameterManager = new ParameterManager();
  renderer = new SpiroRenderer(parameterManager);
  orrery = new Orrery(parameterManager, renderer);
  signature = new ArtistSignature();
  setupEventListeners();

  // Check if URL contains shared preset hash
  if (window.location.hash) {
    if (parameterManager.fromUrlHash(window.location.hash)) {
      currentThemeName = "Shared Link";
      const themeSelect = document.getElementById("themeSelect");
      if (themeSelect) themeSelect.value = "Custom";
      showToast("Loaded preset from shared link! 🌀");
    }
  }

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
  document.getElementById("savePreset")?.addEventListener("click", openSavePresetModal, options);
  document.getElementById("cancelSavePreset")?.addEventListener("click", closeSavePresetModal, options);
  document.getElementById("confirmSavePreset")?.addEventListener("click", handleConfirmSavePreset, options);
  document.getElementById("reloadThemes")?.addEventListener("click", reloadThemes, options);
  document.getElementById("exportThemes")?.addEventListener("click", exportAllThemes, options);
  document.getElementById("saveImageBtn")?.addEventListener("click", saveImage, options);
  document.getElementById("exportSvgBtn")?.addEventListener("click", exportSVG, options);
  document.getElementById("shareUrlBtn")?.addEventListener("click", shareUrl, options);
  document.getElementById("captureVideoBtn")?.addEventListener("click", toggleRecording, options);
  document.getElementById("autoScaleBtn")?.addEventListener("click", () => {
    autoAdjustScale();
    renderer.reset();
  }, options);

  // Close modal when clicking on backdrop
  document.getElementById("save-theme-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "save-theme-modal") {
      closeSavePresetModal();
    }
  }, options);

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        isPaused = !isPaused;
        showToast(isPaused ? "Paused ⏸️" : "Resumed ▶️");
        break;
      case "KeyR":
        randomizeParameters();
        showToast("Randomized 🎲");
        break;
      case "KeyS":
        saveImage();
        showToast("Saved PNG 🖼️");
        break;
      case "KeyE":
        exportSVG();
        break;
      case "KeyF":
        toggleFullscreenCanvas();
        break;
      case "KeyM":
        const orreryEl = document.getElementById("showOrrery");
        if (orreryEl) {
          orreryEl.checked = !orreryEl.checked;
          parameterManager.updateStateFromUI();
        }
        break;
      case "KeyC":
        renderer.reset();
        showToast("Canvas Cleared 🧹");
        break;
    }
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

      // List of parameters that require clearing the canvas when changed
      const resetParams = [
        'complexity',
        'curveType', 
        'dualCurveMode', 
        'secondaryCurve', 
        'dualModeType',
        'outerRadius', 
        'innerRadius', 
        'centerSize',
        'numPoints', 
        'numLayers', 
        'layerOffsetMode', 
        'layerOffsetAmount', 
        'reverseLayers',
        'mirrorSymmetry',
        'm', 'n1', 'n2', 'n3',
        'f1', 'f2', 'd1', 'd2'
      ];

      if (resetParams.includes(changedId)) {
        renderer.reset();
      }
      
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
        mirrorSymmetry: !!choice.mirrorSymmetry,
        animSpeed: choice.speed ?? 0.02,
        trailLength: choice.trail ?? 120,
        lineWeight: choice.lineWeight ?? 1.6,
        lineThinning: choice.lineThinning ?? 0.7,
        baseHue: choice.hue ?? 260,
        colorSpread: choice.spread ?? 120,
        colorMode: choice.colorMode || "byPoint",
        glowEffect: !!choice.glowEffect,
        blendMode: choice.blendMode || "source-over",
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
  fill(255, 200);
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



function getCurveBound(type, outer, inner, center) {
  switch (type) {
    case "hypotrochoid": return Math.abs(outer - inner) + (center || 0);
    case "epitrochoid": return (outer + inner) + (center || 0);
    case "rose": return outer;
    case "lissajous": return Math.max(outer, inner);
    case "superformula": return outer;
    case "harmonograph": return outer * 0.5 + inner * 0.5;
    case "hypocycloid": return outer;
    case "epicycloid": return outer + 2 * inner;
    case "cycloid": return Math.PI * inner;
    case "trochoid": return Math.PI * inner + (center || 0);
    case "limacon": return outer + inner;
    case "ellipse": return Math.max(outer, inner);
    case "butterfly": return outer * 1.2;
    case "astroid": return outer;
    case "bicorn": return outer;
    case "freeth's nephroid": return outer + inner;
    case "cardioid": return outer;
    default: return outer || 180;
  }
}

function autoAdjustScale() {
  const { state } = parameterManager;
  let maxRadius = getCurveBound(state.curveType, state.outerRadius, state.innerRadius, state.centerSize);

  if (state.dualCurveMode) {
    const secBound = getCurveBound(state.secondaryCurve, state.outerRadius * 0.8, state.innerRadius * 0.8, state.centerSize * 0.8);
    if (state.dualModeType === "combine") {
      maxRadius += secBound;
    } else {
      maxRadius = Math.max(maxRadius, secBound);
    }
  }

  if (state.layerOffsetMode === "radius" && state.numLayers > 1) {
    maxRadius *= 1 + (state.numLayers - 1) * state.layerOffsetAmount;
  }

  // Account for dynamic oscillations
  maxRadius += 35;

  if (maxRadius > 0) {
    const maxAllowedRadius = min(width, height) / 2;
    const newScale = Math.max(0.1, Math.min(2.0, (maxAllowedRadius / maxRadius) * AUTOSCALE_PADDING));
    parameterManager.state.scale = newScale;
    const scaleInput = document.getElementById("scale");
    if (scaleInput) scaleInput.value = newScale;
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

    if (currentVal && Array.from(themeSelect.options).some(o => o.value === currentVal)) {
        themeSelect.value = currentVal;
    } else {
        // Try to find "Default", otherwise "Custom"
        if (Array.from(themeSelect.options).some(o => o.value === "Default")) {
            themeSelect.value = "Default";
            // Also apply the Default theme state if we're setting it here (likely startup)
            // But applyTheme triggers a fade/reset, which might be jarring on init.
            // Ideally setup() already sets initial state. If setup() used defaults matching "Default" theme, we are good.
            // Let's just set the dropdown for now.
             currentThemeName = "Default"; 
        } else {
            themeSelect.value = "Custom";
        }
    }
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

function showToast(message) {
  const toast = document.getElementById("toast-notification");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }
}

function openSavePresetModal() {
  const modal = document.getElementById("save-theme-modal");
  const nameInput = document.getElementById("presetNameInput");
  if (modal) {
    modal.classList.add("active");
    if (nameInput) {
      nameInput.value = "";
      nameInput.focus();
    }
  }
}

function closeSavePresetModal() {
  const modal = document.getElementById("save-theme-modal");
  if (modal) modal.classList.remove("active");
}

async function handleConfirmSavePreset() {
  const nameInput = document.getElementById("presetNameInput");
  const name = nameInput ? nameInput.value.trim() : "";
  if (!name) {
    alert("Please enter a preset name.");
    return;
  }

  const saveLocRadio = document.querySelector('input[name="saveLocation"]:checked');
  const isCommunity = saveLocRadio ? saveLocRadio.value === "community" : false;

  closeSavePresetModal();

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
    mirrorSymmetry: parameterManager.state.mirrorSymmetry,
    speed: parameterManager.state.animSpeed,
    trail: parameterManager.state.trailLength,
    lineWeight: parameterManager.state.lineWeight,
    lineThinning: parameterManager.state.lineThinning,
    baseHue: parameterManager.state.baseHue,
    colorSpread: parameterManager.state.colorSpread,
    colorMode: parameterManager.state.colorMode,
    glowEffect: parameterManager.state.glowEffect,
    blendMode: parameterManager.state.blendMode,
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

  if (isCommunity) {
    // Save to Firebase (community)
    try {
      const { collection, addDoc } = window.firebaseFunctions;
      const docRef = await addDoc(collection(window.firestore, "themes"), newPreset);
      newPreset.id = docRef.id;
      newPreset.isCommunity = true;

      window.themes.push(newPreset);
      populateThemes();

      const themeSelect = document.getElementById("themeSelect");
      if (themeSelect) {
        themeSelect.value = name;
      }

      showToast(`'${name}' shared with community! 🌐🎉`);
    } catch (err) {
      console.error("Failed to save to Firebase:", err);
      showToast("Failed to save to community. Saving locally.");
      savePresetLocally(newPreset);
    }
  } else {
    savePresetLocally(newPreset);
  }
}

function savePresetLocally(newPreset) {
  newPreset.isBuiltIn = false;
  try {
    const localThemes = JSON.parse(localStorage.getItem("spiro_custom_themes") || "[]");
    localThemes.push(newPreset);
    localStorage.setItem("spiro_custom_themes", JSON.stringify(localThemes));

    window.themes.push(newPreset);
    populateThemes();

    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect) {
      themeSelect.value = newPreset.name;
    }

    showToast(`Preset '${newPreset.name}' saved locally! 💾`);
  } catch (err) {
    console.error("Failed to save locally:", err);
    showToast("Failed to save preset locally.");
  }
}

function exportSVG() {
  const { state } = parameterManager;
  if (!state || !renderer) return;

  const w = width;
  const h = height;
  const cx = w / 2;
  const cy = h / 2;
  const s = state.scale;
  let drift = radians(0.01 * frameCount);

  let svgContent = `<?xml version="1.0" standalone="no"?>\n`;
  svgContent += `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" version="1.1">\n`;
  svgContent += `  <rect width="100%" height="100%" fill="#11141c"/>\n`;
  svgContent += `  <g fill="none" stroke-linecap="round" stroke-linejoin="round">\n`;

  for (let i = 0; i < state.numPoints; i++) {
    const angle = (i * TWO_PI) / state.numPoints + drift;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const mirrorY = (state.mirrorSymmetry && i % 2 === 1) ? -1 : 1;

    for (let l = 0; l < state.numLayers; l++) {
      const buffer = renderer.spirographs[i]?.[l];
      if (!buffer || buffer.count <= 1) continue;

      const numToDraw = Math.min(buffer.count, Math.floor(state.trailLength));
      const minWeight = state.lineWeight * (1 - state.lineThinning);

      let currentHue = state.baseHue;
      switch (state.colorMode) {
        case "byPoint":
          currentHue = (state.baseHue + (i * (state.colorSpread + 45))) % 360;
          break;
        case "byLayer":
          currentHue = (state.baseHue + (l * (state.colorSpread + 135))) % 360;
          break;
        case "mono":
          currentHue = state.baseHue;
          break;
        case "rainbow":
          currentHue = (state.baseHue + (i * state.colorSpread / state.numPoints) + l * 40) % 360;
          break;
      }

      for (let j = 0; j < numToDraw - 1; j++) {
        const p1_idx = (buffer.head - 1 - j + 400) % 400;
        const p2_idx = (buffer.head - 2 - j + 400) % 400;
        const lx1 = buffer.x[p1_idx];
        const ly1 = buffer.y[p1_idx] * mirrorY;
        const lx2 = buffer.x[p2_idx];
        const ly2 = buffer.y[p2_idx] * mirrorY;

        const gx1 = cx + (lx1 * cosA - ly1 * sinA) * s;
        const gy1 = cy + (lx1 * sinA + ly1 * cosA) * s;
        const gx2 = cx + (lx2 * cosA - ly2 * sinA) * s;
        const gy2 = cy + (lx2 * sinA + ly2 * cosA) * s;

        const progress = (numToDraw - 1 - j) / (numToDraw - 1);
        const weight = Math.max(0.2, (minWeight + (state.lineWeight - minWeight) * progress) * s);

        if (state.colorMode === "gradient") {
          currentHue = (state.baseHue + (progress * state.colorSpread)) % 360;
        }

        const bri = 95, sat = 70;
        const lum = (bri * (1 - sat / 200)).toFixed(1);
        const satL = (bri === 0 || bri === 100) ? 0 : (((bri - lum) / Math.min(lum, 100 - lum)) * 100).toFixed(1);
        const strokeColor = `hsla(${Math.round(currentHue)}, ${satL}%, ${lum}%, 0.85)`;

        svgContent += `    <line x1="${gx1.toFixed(2)}" y1="${gy1.toFixed(2)}" x2="${gx2.toFixed(2)}" y2="${gy2.toFixed(2)}" stroke="${strokeColor}" stroke-width="${weight.toFixed(2)}"/>\n`;
      }
    }
  }

  svgContent += `  </g>\n</svg>`;

  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  downloadLink.href = url;
  downloadLink.download = `spiralmuse_${timestamp}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
  showToast("SVG Vector Exported! 📐");
}

function shareUrl() {
  const hash = parameterManager.toUrlHash();
  const shareableUrl = window.location.origin + window.location.pathname + hash;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareableUrl).then(() => {
      showToast("Preset link copied to clipboard! 🔗");
    }).catch(() => {
      prompt("Copy this preset URL:", shareableUrl);
    });
  } else {
    prompt("Copy this preset URL:", shareableUrl);
  }
}

function reloadThemes() {
  const oldScript = document.querySelector('script[src^="themes.js"]');
  if (oldScript) oldScript.remove();

  const script = document.createElement('script');
  script.src = `themes.js?t=${new Date().getTime()}`;
  script.onload = () => {
    // Mark these as built-in
    if (window.themes) {
        window.themes.forEach(t => t.isBuiltIn = true);
    }
    
    // Re-load custom themes (local + community)
    loadCustomThemes().then(() => {
        populateThemes();
        alert("Themes reloaded successfully!");
    });
  };
  script.onerror = () => {
    alert("Failed to reload themes.js");
  };
  document.body.appendChild(script);
}

function exportAllThemes() {
  if (!window.themes || window.themes.length === 0) {
    alert("No themes to export!");
    return;
  }

  // Create a clean copy of themes, removing internal flags if desired, 
  // or keep them to preserve origin info (community vs local). 
  // Here we'll export everything as is.
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.themes, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  downloadAnchorNode.setAttribute("download", `spiralmuse_themes_${timestamp}.json`);
  
  document.body.appendChild(downloadAnchorNode); // Required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function shuffleTheme() {
  if (!Array.isArray(window.themes) || window.themes.length === 0) return;
  if (fadeState !== "none") return;
  nextTheme = window.themes[Math.floor(Math.random() * window.themes.length)];
  currentThemeName = nextTheme.name;
  
  // Update the dropdown to match the selected theme
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
      themeSelect.value = nextTheme.name;
  }
  
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
  renderer?.clear();
});