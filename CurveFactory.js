const CurveFactory = {
  formulas: {
    hypotrochoid: (t, { outer, inner, center }) => {
        const x = (outer - inner) * Math.cos(t) + center * Math.cos(((outer - inner) / inner) * t);
        const y = (outer - inner) * Math.sin(t) - center * Math.sin(((outer - inner) / inner) * t);
        return { x, y };
    },
    epitrochoid: (t, { outer, inner, center }) => {
        const x = (outer + inner) * Math.cos(t) - center * Math.cos(((outer + inner) / inner) * t);
        const y = (outer + inner) * Math.sin(t) - center * Math.sin(((outer + inner) / inner) * t);
        return { x, y };
    },
    rose: (t, { outer, inner }) => {
        const k = inner / outer;
        const r = outer * Math.cos(k * t);
        const x = r * Math.cos(t);
        const y = r * Math.sin(t);
        return { x, y };
    },
    lissajous: (t, { outer, inner, center }) => {
        const a = Math.max(1, parseInt(outer / 20)), b = Math.max(1, parseInt(inner / 20)), delta = center * 0.01;
        const x = outer * Math.sin(a * t + delta);
        const y = inner * Math.sin(b * t);
        return { x, y };
    },
    superformula: (t, { outer, m, n1, n2, n3 }) => {
        const a = 1, b = 1;
        const part1 = Math.pow(Math.abs(Math.cos((m * t) / 4) / a), n2);
        const part2 = Math.pow(Math.abs(Math.sin((m * t) / 4) / b), n3);
        const denom = Math.pow(part1 + part2, 1 / n1);
        const r = denom === 0 ? 0 : 1.0 / denom;
        const x = outer * r * Math.cos(t);
        const y = outer * r * Math.sin(t);
        return { x, y };
    },
    harmonograph: (t, { outer, inner, f1, f2, d1, d2 }) => {
        const scaledT = t * 0.02;
        const A = outer * 0.5, B = inner * 0.5;
        const x = A * Math.sin(f1 * scaledT + 0.5) * Math.exp(-d1 * scaledT);
        const y = B * Math.sin(f2 * scaledT) * Math.exp(-d2 * scaledT);
        return { x, y };
    },
    hypocycloid: (t, { outer, inner }) => {
        const x = (outer - inner) * Math.cos(t) + inner * Math.cos(((outer - inner) / inner) * t);
        const y = (outer - inner) * Math.sin(t) - inner * Math.sin(((outer - inner) / inner) * t);
        return { x, y };
    },
    epicycloid: (t, { outer, inner }) => {
        const x = (outer + inner) * Math.cos(t) - inner * Math.cos(((outer + inner) / inner) * t);
        const y = (outer + inner) * Math.sin(t) - inner * Math.sin(((outer + inner) / inner) * t);
        return { x, y };
    },
    cycloid: (t, { inner }) => {
        const period = Math.PI * 2;
        const normT = ((t % period) + period) % period - Math.PI;
        const x = inner * (normT - Math.sin(normT));
        const y = inner * (1 - Math.cos(normT)) - inner;
        return { x, y };
    },
    trochoid: (t, { inner, center }) => {
        const period = Math.PI * 2;
        const normT = ((t % period) + period) % period - Math.PI;
        const x = inner * normT - center * Math.sin(normT);
        const y = -center * Math.cos(normT);
        return { x, y };
    },
    limacon: (t, { outer, inner }) => {
        const r = outer + inner * Math.cos(t);
        const x = r * Math.cos(t);
        const y = r * Math.sin(t);
        return { x, y };
    },
    ellipse: (t, { outer, inner }) => {
        const x = outer * Math.cos(t);
        const y = inner * Math.sin(t);
        return { x, y };
    },
    butterfly: (t, { outer }) => {
        const scale = outer / 40;
        t *= 2;
        const p = (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5));
        const x = Math.sin(t) * p * scale * 8;
        const y = -Math.cos(t) * p * scale * 8;
        return { x, y };
    },
    astroid: (t, { outer }) => {
        const x = outer * Math.pow(Math.cos(t), 3);
        const y = outer * Math.pow(Math.sin(t), 3);
        return { x, y };
    },
    bicorn: (t, { outer }) => {
        const x = outer * Math.cos(t);
        const y = outer * (Math.pow(Math.sin(t), 2)) / (2 + Math.sin(t));
        return { x, y };
    },
    "freeth's nephroid": (t, { outer, inner }) => {
        const k = inner / outer;
        const x = outer * (1 + k * Math.sin(t/2)) * Math.cos(t);
        const y = outer * (k + Math.sin(t/2)) * Math.sin(t);
        return { x, y };
    },
    cardioid: (t, { outer }) => {
        const a = outer / 4;
        const x = a * (2 * Math.cos(t) - Math.cos(2*t));
        const y = a * (2 * Math.sin(t) - Math.sin(2*t));
        return { x, y };
    }
  },

  getFormula(name) {
    return this.formulas[name] || this.formulas.hypotrochoid;
  }
};
