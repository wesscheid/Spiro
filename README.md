# 🌀 Spirograph App

A mesmerizing, interactive web app for exploring **spirograph-inspired mathematical patterns** in real time.  
Designed for creative exploration and smooth animation — built with **p5.js**, modular JavaScript, and a dark, modern UI.

---

## ✨ Features

- **Diverse Curve Types**: Explore Hypotrochoid, Epitrochoid, Rose, Lissajous, Superformula, Harmonograph, Cardioid, Butterfly, Astroid, and more (17+ mathematical formulas).
- **📐 Vector SVG Export**: Export crisp, scalable vector XML files directly for pen plotters (AxiDraw), laser cutting, Cricut, and high-res print.
- **✨ Glow / Neon Bloom & Blend Modes**: Additive neon luminescence, screen blending, and glow effects.
- **🌀 Mirror Symmetry (Mandala)**: Alternating chiral symmetry for sacred geometry and mandala patterns.
- **🔗 Instant URL Preset Sharing**: 1-click shareable URLs with parameter hash encoding.
- **⌨️ Desktop Keyboard Shortcuts**: Hotkeys for pause (`Space`), randomize (`R`), save PNG (`S`), export SVG (`E`), fullscreen (`F`), mechanics (`M`), and clear (`C`).
- **Smart Rendering**: Adjust colors, line styles, and zoom levels *without* clearing the canvas—only shape-altering parameters trigger a redraw. Zero-allocation typed array buffers for silky smooth 60 FPS.
- **Cloud & Local Saving**: Save your custom themes locally or publish them to the global community library (powered by Firebase).
- **Enhanced Theme Management**: Export your entire theme library (local + cloud) to JSON for backup. Edit `themes.js` locally and reload instantly via the UI without refreshing.
- **Interactive Mechanics (Orrery)**: Toggle the "Show Mechanics" visualization to see the rotating arms and gears driving the animation, with interactive on-canvas drag controls.
- **Dual-Curve Blending**: Combine or morph between two different curve types for complex interference patterns.
- **Multi-Layer Rendering**: Stack layers with configurable offsets (radius, rotation, phase) and varying directions.
- **Video Capture**: Record your animations directly to `webm` video files (5s, 10s, or 15s).
- **Dynamic Styling**: Real-time control over line weight, thinning, color gradients, and "vibe" complexity.
- **Artist Branding**: Integrated dynamic logo visualization during transitions.

---

## 🚀 Getting Started

### **1. Open locally**
You can run it directly in any modern browser.

1. Clone or download the repository.
2. Open `index.html` in your browser.
3. Adjust sliders and settings to create unique spiro patterns.
4. **Tip:** You can edit `themes.js` locally to add your own built-in presets, then hit "Reload Themes.js" in the Advanced tab to see changes instantly.

### **2. Host via GitHub Pages**
1. Go to your repo → **Settings → Pages**.
2. Under **Build and deployment**, set:
   - Source → **Deploy from a branch**
   - Branch → `main`
   - Folder → `/ (root)`
3. Save and wait for the link to appear.
4. Visit:  
   👉 `https://yourusername.github.io/spirograph-app/`

---

## 🧠 Tips & Shortcuts

### **Keyboard Shortcuts**
| Key | Action |
| :--- | :--- |
| `Space` | Pause / Resume animation |
| `R` | Randomize all parameters |
| `S` | Save high-res PNG image |
| `E` | Export SVG vector file (plotter ready) |
| `F` | Toggle fullscreen mode |
| `M` | Toggle mechanical Orrery visualization |
| `C` | Clear canvas trails |

- **Auto Randomize**: Enable "Auto Randomize" in the Advanced section to cycle through infinite random variations automatically with a configurable interval.
- **Vector Export**: Click "Export SVG" (or press `E`) to generate clean vector line paths for AxiDraw pen plotters, Cricut, laser cutters, or Adobe Illustrator.
- **Preset Sharing**: Click "Share Preset Link" to copy a self-contained URL that opens your exact spirograph pattern on any device.
- **Community Themes**: Browse the "Theme" dropdown to see presets created by other users (marked with 🌐).
- **Smooth Motion**: Try small **Animation Speed** values (0.005–0.03) for smoother, hypnotic motion.  
- **Dual Mode**: Use the **Dual Curve Mode** to mix harmonograph and spiro formulas.  
- **Recording**: Use the "Capture Video" button to share your creations.

---

## 🧩 Tech Stack

- [p5.js](https://p5js.org/) – Creative coding framework
- [Firebase](https://firebase.google.com/) - Cloud storage for community themes
- [CCapture.js](https://github.com/spite/ccapture.js/) - Video recording
- Vanilla JS + HTML + CSS  

---

## 🧑‍💻 Author

**Wes Scheid**  
Creative technologist • LED tinkerer • visual pattern enthusiast  
💻 [wesscheid.site](https://www.wesscheid.site)

---

## 🪄 License

MIT License — free for personal and creative use.  
If you remix or publish your own version, please include credit or a link back here.

---

> “Mathematics is the art of giving the same name to different things.”  
> — Henri Poincaré