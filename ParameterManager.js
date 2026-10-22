class ParameterManager {
  constructor() {
    this.state = {};
    this.controls = {}; // Cache DOM elements

    // A list of all parameter IDs from the HTML
    this.paramIds = [
      // Vibe
      "complexity",
      // Shape
      "curveType", "dualCurveMode", "secondaryCurve", "dualModeType",
      "outerRadius", "innerRadius", "centerSize", "numPoints", "scale",
      "numLayers", "layerOffsetMode", "layerOffsetAmount", "reverseLayers", "mirrorSymmetry",
      // Style
      "animSpeed", "trailLength", "lineWeight", "lineThinning", "baseHue", "colorSpread", "colorMode", "glowEffect", "blendMode",
      // Advanced
      "showOrrery", "m", "n1", "n2", "n3", "f1", "f2", "d1", "d2",
      // Auto-play
      "autoPlay", "autoPlayInterval"
    ];

    // Find and cache all the control elements
    this.paramIds.forEach(id => {
        this.controls[id] = document.getElementById(id);
    });

    this.updateStateFromUI(); // Initialize state by reading current values from the DOM
  }

  /**
   * Reads all values from the DOM elements and updates the internal state object.
   */
  updateStateFromUI() {
    currentThemeName = "Custom"; // Set theme to custom whenever a control is changed
    this.paramIds.forEach(id => {
      const el = this.controls[id];
      if (!el) return;

      let value;
      if (el.type === "checkbox") {
        value = el.checked;
      } else {
        // Use parseFloat for all sliders/number inputs for consistency
        value = !isNaN(parseFloat(el.value)) ? parseFloat(el.value) : el.value;
      }
      this.state[id] = value;
    });
    this.updateValueDisplays();

    // Special handling for visibility toggles
    this.updateParameterVisibility(this.state.curveType, this.state.secondaryCurve);
    const autoPlaySlider = document.getElementById("autoPlay-slider-container");
    if (autoPlaySlider) {
      autoPlaySlider.style.display = this.state.autoPlay ? "block" : "none";
    }

    return this.state;
  }

  /**
   * Updates the DOM control values from the internal state object.
   * Useful for loading themes or presets.
   */
  updateUIFromState() {
    this.paramIds.forEach(id => {
      const el = this.controls[id];
      // Check if control exists and the state for it is defined
      if (!el || this.state[id] === undefined) return;

      if (el.type === "checkbox") {
        el.checked = this.state[id];
      } else {
        el.value = this.state[id];
      }
    });
    this.updateValueDisplays();
    this.updateParameterVisibility(this.state.curveType, this.state.secondaryCurve);
    const autoPlaySlider = document.getElementById("autoPlay-slider-container");
    if (autoPlaySlider) {
      autoPlaySlider.style.display = this.state.autoPlay ? "block" : "none";
    }
  }
  
  /**
   * Updates the "-value" span indicators next to range sliders.
   */
  updateValueDisplays() {
      this.paramIds.forEach(id => {
          const el = this.controls[id];
          if (!el || el.type !== 'range') return;
          
          const display = document.getElementById(id + "-value");
          if (display) {
              const val = parseFloat(el.value);
              // Check if step is a float or int for formatting
              display.textContent = String(el.step || "").includes('.') ? val.toFixed(2) : Math.round(val);
          }
      });
  }

  /**
   * Binds event listeners to all managed controls. When a control is changed,
   * it updates the state and then calls the provided callback function.
   * @param {function} onUpdateCallback - The function to call after the state is updated.
   */
  bindUI(onUpdateCallback) {
    this.paramIds.forEach(id => {
      const el = this.controls[id];
      if (el) {
        const eventType = el.type === "checkbox" ? "change" : "input";
        el.addEventListener(eventType, () => {
          this.updateStateFromUI();
          onUpdateCallback(id); // Pass the ID of the changed control
        });
      }
    });
  }

  /**
   * Hides or shows controls based on the selected curve types.
   */
  updateParameterVisibility(primaryCurveType, secondaryCurveType) {
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
    const secondaryVisibility = this.state.dualCurveMode && visibility[secondaryCurveType] ? visibility[secondaryCurveType] : [];

    Object.keys(controls).forEach(key => {
      if (primaryVisibility.includes(key) || secondaryVisibility.includes(key)) {
        controls[key].style.display = "block";
      } else {
        controls[key].style.display = "none";
      }
    });
  }

  /**
   * Validates the internal state in place: drops unknown keys, coerces
   * numeric values and clamps them to the control ranges, resets invalid
   * enum values to safe defaults, and coerces booleans. Anything that
   * enters state from outside the UI (URL hashes, saved themes, community
   * themes from Firestore) must pass through here — unvalidated values
   * can otherwise produce NaN geometry (e.g. innerRadius 0 divides by
   * zero in several curve formulas) and a silently blank canvas.
   */
  sanitizeState() {
    const numericRanges = {
      complexity: [0, 1], outerRadius: [20, 400], innerRadius: [5, 300],
      centerSize: [0, 300], numPoints: [1, 48], numLayers: [1, 16],
      layerOffsetAmount: [0, 1], animSpeed: [0, 0.1], trailLength: [10, 400],
      lineWeight: [0.1, 6], lineThinning: [0, 1], baseHue: [0, 360],
      colorSpread: [0, 360], scale: [0.1, 2], autoPlayInterval: [2, 30],
      m: [0, 20], n1: [0.1, 10], n2: [0.1, 10], n3: [0.1, 10],
      f1: [0, 10], f2: [0, 10], d1: [0, 0.1], d2: [0, 0.1]
    };
    const numericDefaults = {
      complexity: 0.5, outerRadius: 180, innerRadius: 80, centerSize: 60,
      numPoints: 12, numLayers: 2, layerOffsetAmount: 0.06, animSpeed: 0.04,
      trailLength: 50, lineWeight: 1.6, lineThinning: 0.7, baseHue: 260,
      colorSpread: 120, scale: 1, autoPlayInterval: 5,
      m: 6, n1: 0.3, n2: 1.7, n3: 1.7, f1: 2, f2: 3, d1: 0.0006, d2: 0.0008
    };
    const integerKeys = new Set([
      "outerRadius", "innerRadius", "centerSize", "numPoints", "numLayers",
      "trailLength", "baseHue", "colorSpread", "autoPlayInterval"
    ]);
    const curveNames = (typeof CurveFactory !== "undefined")
      ? Object.keys(CurveFactory.formulas)
      : null; // If CurveFactory failed to load, leave curve names unchecked.
    const enums = {
      layerOffsetMode: ["radius", "rotation", "phase"],
      dualModeType: ["blend", "combine", "alternate"],
      colorMode: ["byPoint", "byLayer", "gradient", "mono", "rainbow"],
      blendMode: ["source-over", "lighter", "screen", "multiply", "difference"]
    };
    if (curveNames) {
      enums.curveType = curveNames;
      enums.secondaryCurve = curveNames;
    }
    const enumDefaults = {
      curveType: "hypotrochoid", secondaryCurve: "hypotrochoid",
      layerOffsetMode: "radius", dualModeType: "blend",
      colorMode: "byPoint", blendMode: "source-over"
    };
    const booleanKeys = [
      "dualCurveMode", "reverseLayers", "mirrorSymmetry",
      "glowEffect", "showOrrery", "autoPlay"
    ];

    // Drop keys the UI does not own.
    const allowed = new Set(this.paramIds);
    Object.keys(this.state).forEach(key => {
      if (!allowed.has(key)) delete this.state[key];
    });

    Object.entries(numericRanges).forEach(([key, [min, max]]) => {
      if (this.state[key] === undefined) return;
      let value = parseFloat(this.state[key]);
      if (!Number.isFinite(value)) value = numericDefaults[key];
      value = Math.min(max, Math.max(min, value));
      if (integerKeys.has(key)) value = Math.round(value);
      this.state[key] = value;
    });

    Object.entries(enums).forEach(([key, values]) => {
      if (this.state[key] === undefined) return;
      if (!values.includes(this.state[key])) this.state[key] = enumDefaults[key];
    });

    booleanKeys.forEach(key => {
      if (this.state[key] === undefined) return;
      this.state[key] = this.state[key] === true || this.state[key] === "true";
    });

    return this.state;
  }

  /**
   * Serializes the current parameter state to a URL hash string.
   */
  toUrlHash() {
    const compact = {};
    this.paramIds.forEach(id => {
      if (this.state[id] !== undefined && this.state[id] !== null) {
        compact[id] = this.state[id];
      }
    });
    return '#' + encodeURIComponent(btoa(JSON.stringify(compact)));
  }

  /**
   * Deserializes and loads parameters from a URL hash string.
   */
  fromUrlHash(hashStr) {
    if (!hashStr || hashStr.length <= 1) return false;
    try {
      const raw = hashStr.startsWith('#') ? hashStr.slice(1) : hashStr;
      const jsonStr = atob(decodeURIComponent(raw));
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        Object.assign(this.state, parsed);
        this.sanitizeState();
        this.updateUIFromState();
        return true;
      }
    } catch (e) {
      console.warn("Failed to parse URL hash preset:", e);
    }
    return false;
  }
}
