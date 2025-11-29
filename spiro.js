let parameterManager;
let spirographs = [];
let theta = 0;
let renderer;
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

        // Fill with a transparent version of the new background color for the trail effect
        fill(224, 39, 11, constrain(100 - state.trailLength / 20, 2, 95));
        noStroke();
        rect(0, 0, width, height);

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

                    let hue = (state.baseHue + (index * state.colorSpread / state.numPoints) + layer * 40) % 360;

                    stroke(hue, 70, 95, 85);

                    noFill();

        

                    const minWeight = state.lineWeight * (1 - state.lineThinning);

        

                    // Backtrack from the head to draw the trail.

                    for (let j = 0; j < numToDraw - 1; j++) {

                        // j=0 is the segment closest to the head (newest)

                        const p1_idx = (buffer.head - 1 - j + 400) % 400;

                        const p2_idx = (buffer.head - 2 - j + 400) % 400;

                        

                        const p1 = buffer.points[p1_idx];

                        const p2 = buffer.points[p2_idx];

        

                        if (p1 && p2) {

                            // progress=1 is the newest segment, progress=0 is the oldest.

                            const progress = (numToDraw - 1 - j) / (numToDraw - 1);

                            const weight = lerp(minWeight, state.lineWeight, progress);

                            strokeWeight(weight);

                            line(p1.x, p1.y, p2.x, p2.y);

                        }

                    }

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

  parameterManager = new ParameterManager();
  renderer = new SpiroRenderer(parameterManager);
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
      resetSpirographs();
      resetAutoPlayTimer();
  });
}

function windowResized() {
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);
  renderer.clear();
}



function draw() {
  // Handle theme transition fade
  if (fadeState === "fading-out") {
    fadeAlpha = min(fadeAlpha + 10, 255);
    background(290, 80, 10, fadeAlpha);
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
    renderer.draw();
  }

  // Handle fade-in after theme transition
  if (fadeState === "fading-in") {
    fadeAlpha = max(fadeAlpha - 10, 0);
    background(290, 80, 10, fadeAlpha);
    if (fadeAlpha === 0) {
      fadeState = "none";
    }
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