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
      "numLayers", "layerOffsetMode", "layerOffsetAmount", "reverseLayers",
      // Style
      "animSpeed", "trailLength", "lineWeight", "lineThinning", "baseHue", "colorSpread", "colorMode",
      // Advanced
      "m", "n1", "n2", "n3", "f1", "f2", "d1", "d2",
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
}
