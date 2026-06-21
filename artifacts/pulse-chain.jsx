import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";

/* =========================================================================
   REAL DSP CORE  (no faked numbers — everything below is actual computation)
   ========================================================================= */

// In-place iterative radix-2 Cooley–Tukey FFT. inverse=true → IFFT (1/N scaled).
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = i + k + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi;
        re[a] = re[a] + vr; im[a] = im[a] + vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// Continuous-time transfer functions, returning [Re, Im].
// CR high-pass:  H = jωτ /(1+jωτ)
function Hcr(omega, tau) {
  const a = omega * tau, d = 1 + a * a;
  return [(a * a) / d, a / d];
}
// RC low-pass:   H = 1   /(1+jωτ)
function Hlp(omega, tau) {
  const a = omega * tau, d = 1 + a * a;
  return [1 / d, -a / d];
}

// Bi-exponential detector pulse: A·(e^{-t/τf} − e^{-t/τr}), causal from t0.
function makePulse(N, dt, { t0, tr, tf, amp }) {
  const x = new Float64Array(N);
  // peak-normalise the unit bi-exponential so amp is the true peak height
  const tp = (tr * tf) / (tf - tr) * Math.log(tf / tr);
  const peak = Math.exp(-tp / tf) - Math.exp(-tp / tr);
  for (let n = 0; n < N; n++) {
    const t = n * dt - t0;
    if (t < 0) continue;
    x[n] = (amp / peak) * (Math.exp(-t / tf) - Math.exp(-t / tr));
  }
  return x;
}

// Frequency-domain filtering: FFT → ×H(jω) → IFFT. Returns real output.
function freqFilter(x, dt, hfns) {
  const n = x.length;
  const re = Float64Array.from(x), im = new Float64Array(n);
  fft(re, im, false);
  for (let k = 0; k < n; k++) {
    const f = (k <= n / 2 ? k : k - n) / (n * dt); // signed frequency
    const w = 2 * Math.PI * f;
    let hr = 1, hi = 0;
    for (const h of hfns) {
      const [r, i] = h(w);
      const nr = hr * r - hi * i;
      hi = hr * i + hi * r; hr = nr;
    }
    const ar = re[k], ai = im[k];
    re[k] = ar * hr - ai * hi;
    im[k] = ar * hi + ai * hr;
  }
  fft(re, im, true);
  return re;
}

// Bilinear-transform IIR. k = 2τ/dt.  (matches H(jω) of the analog filter)
function iirCR(x, tau, dt) {
  const k = (2 * tau) / dt, g = 1 / (1 + k);
  const b0 = k * g, b1 = -k * g, a1 = (1 - k) * g;
  const y = new Float64Array(x.length);
  for (let n = 1; n < x.length; n++)
    y[n] = b0 * x[n] + b1 * x[n - 1] - a1 * y[n - 1];
  return y;
}
function iirRC(x, tau, dt) {
  const k = (2 * tau) / dt, g = 1 / (1 + k);
  const b = g, a1 = (1 - k) * g;
  const y = new Float64Array(x.length);
  y[0] = b * x[0];
  for (let n = 1; n < x.length; n++)
    y[n] = b * x[n] + b * x[n - 1] - a1 * y[n - 1];
  return y;
}

// Leading-edge discriminator: rising-edge threshold crossings + over-threshold flag.
function discriminate(x, th) {
  const N = x.length;
  const over = new Uint8Array(N);
  const edges = [];
  for (let n = 1; n < N; n++) {
    over[n] = x[n] >= th ? 1 : 0;
    if (x[n - 1] < th && x[n] >= th) edges.push(n);
  }
  return { over, edges };
}

// Dual timer + veto. Gate (timer 1) = integration window; veto (timer 2) = dead time.
// A new trigger inside the veto window is rejected; if it lands inside a live gate it
// flags pile-up on the event being measured.
function dualTimer(edges, N, gateS, vetoS) {
  const gate = new Uint8Array(N);
  const veto = new Uint8Array(N);
  const accepted = [];
  let gateEnd = -1, vetoEnd = -1, rejected = 0, pileup = 0;
  let curEvt = null;
  for (const e of edges) {
    if (e < vetoEnd) {                 // inside dead time → reject
      rejected++;
      if (curEvt && e < curEvt.gateEnd && !curEvt.pile) { curEvt.pile = true; pileup++; }
      continue;
    }
    gateEnd = e + gateS; vetoEnd = e + vetoS;
    curEvt = { start: e, gateEnd, pile: false };
    accepted.push(curEvt);
    for (let n = e; n < Math.min(N, gateEnd); n++) gate[n] = 1;
    for (let n = e; n < Math.min(N, vetoEnd); n++) veto[n] = 1;
  }
  return { gate, veto, accepted, rejected, pileup };
}

const sum = (x, a, b) => { let s = 0; for (let n = a; n < b; n++) s += x[n]; return s; };

/* =========================================================================
   FORMATTING
   ========================================================================= */
const fmtT = (s) => s >= 1e-6 ? (s * 1e6).toFixed(2) + " µs"
  : s >= 1e-9 ? (s * 1e9).toFixed(0) + " ns" : (s * 1e12).toFixed(0) + " ps";
const fmtNs = (s) => Math.round(s * 1e9) + " ns";

/* =========================================================================
   CHANNEL PALETTE (Tektronix-style per-stage colours)
   ========================================================================= */
const C = {
  bg: "#0a0d12", panel: "#11161d", bezel: "#1b222c", screen: "#07090d",
  grid: "#161d27", gridHot: "#1f2a39",
  ink: "#c9d4e0", dim: "#5d6b7d", label: "#8794a6",
  ch1: "#f2c14e", ch2: "#3fd0d8", ch3: "#e86fc0", ch4: "#7ad96b",
  warn: "#ff6b5e", veto: "#ff4d4d", gate: "#7ad96b",
};

/* =========================================================================
   SCOPE (multi-lane time-domain display)
   ========================================================================= */
function Scope({ data, dt, threshold, sweep, showFFTpath }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const N = data.input.length, T = N * dt;
    const padL = 52, padR = 10, padT = 6, padB = 18;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const xAt = (n) => padL + (n / (N - 1)) * plotW;

    // grid
    g.strokeStyle = C.grid; g.lineWidth = 1;
    const divX = 8;
    g.font = "9px ui-monospace, Menlo, monospace"; g.fillStyle = C.dim; g.textAlign = "center";
    for (let i = 0; i <= divX; i++) {
      const x = padL + (i / divX) * plotW;
      g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + plotH); g.stroke();
      g.fillText(fmtT((i / divX) * T), x, H - 5);
    }

    const lanes = [
      { key: "input", label: "INPUT", color: C.ch1, fft: null },
      { key: "hp_iir", label: "HPF (CR)", color: C.ch2, fft: "hp_fft" },
      { key: "shaped_iir", label: "SHAPED", color: C.ch4, fft: "shaped_fft" },
    ];
    const laneH = plotH / 4;

    lanes.forEach((ln, idx) => {
      const y0 = padT + idx * laneH;
      const cy = y0 + laneH * 0.5;
      // baseline + label
      g.strokeStyle = C.gridHot; g.lineWidth = 1;
      g.beginPath(); g.moveTo(padL, cy); g.lineTo(padL + plotW, cy); g.stroke();
      g.fillStyle = ln.color; g.textAlign = "right"; g.font = "10px ui-monospace, Menlo, monospace";
      g.fillText(ln.label, padL - 6, y0 + 12);

      const arr = data[ln.key];
      let mx = 1e-12; for (let n = 0; n < N; n++) mx = Math.max(mx, Math.abs(arr[n]));
      const yAt = (v) => cy - (v / mx) * laneH * 0.42;
      const clip = Math.floor((N - 1) * sweep);

      // threshold marker on shaped lane
      if (ln.key === "shaped_iir") {
        g.strokeStyle = "rgba(255,107,94,0.55)"; g.setLineDash([4, 4]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(padL, yAt(threshold)); g.lineTo(padL + plotW, yAt(threshold)); g.stroke();
        g.setLineDash([]);
        g.fillStyle = "rgba(255,107,94,0.8)"; g.textAlign = "left"; g.font = "8px ui-monospace, monospace";
        g.fillText("thr", padL + 3, yAt(threshold) - 3);
      }

      // FFT-path trace (dotted)
      if (showFFTpath && ln.fft && data[ln.fft]) {
        const f = data[ln.fft];
        g.strokeStyle = ln.color + "66"; g.setLineDash([2, 3]); g.lineWidth = 1;
        g.beginPath();
        for (let n = 0; n <= clip; n++) { const x = xAt(n), y = yAt(f[n]); n ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke(); g.setLineDash([]);
      }
      // IIR-path trace (solid, glow)
      g.shadowColor = ln.color; g.shadowBlur = 6;
      g.strokeStyle = ln.color; g.lineWidth = 1.4;
      g.beginPath();
      for (let n = 0; n <= clip; n++) { const x = xAt(n), y = yAt(arr[n]); n ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.shadowBlur = 0;
    });

    // logic lane (discriminator + gate + veto)
    {
      const y0 = padT + 3 * laneH, cy = y0 + laneH * 0.5;
      g.fillStyle = C.label; g.textAlign = "right"; g.font = "10px ui-monospace, Menlo, monospace";
      g.fillText("LOGIC", padL - 6, y0 + 12);
      const top = y0 + laneH * 0.30, bot = y0 + laneH * 0.78;
      const clip = Math.floor((N - 1) * sweep);
      const band = (arr, color, yT, yB, fill) => {
        g.strokeStyle = color; g.lineWidth = 1.3;
        if (fill) g.fillStyle = color + "22";
        g.beginPath();
        let prev = 0;
        for (let n = 0; n <= clip; n++) {
          const x = xAt(n), y = arr[n] ? yT : yB;
          if (n === 0) g.moveTo(x, y);
          else { if (arr[n] !== prev) g.lineTo(x, prev ? yB : yT); g.lineTo(x, y); }
          prev = arr[n];
        }
        g.stroke();
        if (fill) {
          g.beginPath(); g.moveTo(xAt(0), yB);
          for (let n = 0; n <= clip; n++) g.lineTo(xAt(n), arr[n] ? yT : yB);
          g.lineTo(xAt(clip), yB); g.closePath(); g.fill();
        }
      };
      band(data.veto, C.veto, top - 2, bot, false);
      band(data.gate, C.gate, top, bot, true);
      g.strokeStyle = C.ink; g.lineWidth = 1.2;
      g.beginPath();
      let prev = 0;
      for (let n = 0; n <= clip; n++) {
        const x = xAt(n), y = data.over[n] ? top : bot;
        if (n === 0) g.moveTo(x, y);
        else { if (data.over[n] !== prev) g.lineTo(x, prev ? bot : top); g.lineTo(x, y); }
        prev = data.over[n];
      }
      g.stroke();
      g.font = "8px ui-monospace, monospace"; g.textAlign = "left";
      g.fillStyle = C.gate; g.fillText("gate", padL + 3, bot + 1);
      g.fillStyle = C.veto; g.fillText("veto", padL + 34, bot + 1);
      g.fillStyle = C.ink; g.fillText("disc", padL + 66, bot + 1);
    }
  });
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* =========================================================================
   SPECTRUM (log-f, dB) with |H(f)| overlays
   ========================================================================= */
function Spectrum({ spec, dt }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const padL = 38, padR = 8, padT = 8, padB = 18;
    const pw = W - padL - padR, ph = H - padT - padB;
    const fmin = 1e5, fmax = 0.5 / dt;       // up to Nyquist
    const dbMax = 6, dbMin = -66;
    const xAt = (f) => padL + (Math.log10(f) - Math.log10(fmin)) / (Math.log10(fmax) - Math.log10(fmin)) * pw;
    const yAt = (db) => padT + (dbMax - db) / (dbMax - dbMin) * ph;

    // grid: decades + dB lines
    g.font = "8px ui-monospace, monospace"; g.textAlign = "center";
    for (let d = 5; d <= 8; d++) {
      const f = Math.pow(10, d);
      if (f < fmin || f > fmax) continue;
      g.strokeStyle = C.gridHot; g.lineWidth = 1;
      g.beginPath(); g.moveTo(xAt(f), padT); g.lineTo(xAt(f), padT + ph); g.stroke();
      const lbl = f >= 1e9 ? (f / 1e9) + "G" : f >= 1e6 ? (f / 1e6) + "M" : (f / 1e3) + "k";
      g.fillStyle = C.dim; g.fillText(lbl + "Hz", xAt(f), H - 5);
    }
    g.textAlign = "right"; g.strokeStyle = C.grid;
    for (let db = 0; db >= -60; db -= 20) {
      g.beginPath(); g.moveTo(padL, yAt(db)); g.lineTo(padL + pw, yAt(db)); g.stroke();
      g.fillStyle = C.dim; g.fillText(db + "dB", padL - 3, yAt(db) + 3);
    }

    const curve = (mag, color, w, dash) => {
      g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash);
      g.beginPath(); let started = false;
      for (let k = 1; k < mag.length; k++) {
        const f = k / (mag.length * 2 * dt); // bin freq (one-sided)
        if (f < fmin) continue;
        const db = 20 * Math.log10(mag[k] + 1e-12);
        const x = xAt(f), y = Math.max(padT, Math.min(padT + ph, yAt(db)));
        started ? g.lineTo(x, y) : (g.moveTo(x, y), started = true);
      }
      g.stroke(); g.setLineDash([]);
    };
    // |H| reference curves
    curve(spec.Hcr, C.ch2 + "99", 1, [3, 3]);
    curve(spec.Hlp, C.ch4 + "99", 1, [3, 3]);
    // signal spectra (normalised to input peak)
    curve(spec.in, C.ch1, 1.4);
    curve(spec.hp, C.ch2, 1.4);
    curve(spec.shaped, C.ch4, 1.6);

    // legend
    g.font = "9px ui-monospace, monospace"; g.textAlign = "left";
    const leg = [["input", C.ch1], ["·Hcr", C.ch2], ["·Hcr·Hlp", C.ch4]];
    let lx = padL + 6;
    leg.forEach(([t, c]) => { g.fillStyle = c; g.fillText(t, lx, padT + 10); lx += g.measureText(t).width + 14; });
  });
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* =========================================================================
   CONTROLS
   ========================================================================= */
function Fader({ label, value, min, max, step, onChange, fmt, color }) {
  return (
    <label style={{ display: "block", marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 0.5, marginBottom: 3 }}>
        <span style={{ color: C.label }}>{label}</span>
        <span style={{ color: color || C.ink, fontFamily: "ui-monospace, monospace" }}>{fmt(value)}</span>
      </div>
      <input className="fdr" type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color || C.ch2 }} />
    </label>
  );
}

function Stat({ label, value, color, sub }) {
  return (
    <div style={{ background: C.screen, border: `1px solid ${C.bezel}`, borderRadius: 4, padding: "7px 9px" }}>
      <div style={{ fontSize: 9, color: C.label, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 17, color: color || C.ink, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.dim, fontFamily: "ui-monospace, monospace" }}>{sub}</div>}
    </div>
  );
}

/* =========================================================================
   MAIN
   ========================================================================= */
function AnalyzerTab() {
  const N = 4096, dt = 1e-9;             // fs = 1 GHz, window ≈ 4.10 µs

  const [p, setP] = useState({
    amp: 1, tr: 10, tf: 100, t0: 400,    // pulse (ns)
    dbl: true, sep: 250,                 // double-pulse mode + separation (ns)
    tauCR: 200, tauRC: 50,               // shaping τ (ns)
    thr: 0.30,                           // threshold (fraction of shaped peak)
    gate: 300, veto: 600,                // dual-timer widths (ns)
    fftPath: true,
  });
  const set = (k) => (v) => setP((s) => ({ ...s, [k]: v }));

  const [sweep, setSweep] = useState(1);
  const rafRef = useRef(0);
  const fire = useCallback(() => {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setSweep(1); return; }
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now(), dur = 520;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setSweep(k);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    setSweep(0); rafRef.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ---- THE PIPELINE (recomputed only when inputs change) ----
  const R = useMemo(() => {
    const tr = p.tr * 1e-9, tf = p.tf * 1e-9, t0 = p.t0 * 1e-9;
    let input = makePulse(N, dt, { t0, tr, tf, amp: p.amp });
    if (p.dbl) {
      const p2 = makePulse(N, dt, { t0: t0 + p.sep * 1e-9, tr, tf, amp: p.amp });
      for (let n = 0; n < N; n++) input[n] += p2[n];
    }

    const tauCR = p.tauCR * 1e-9, tauRC = p.tauRC * 1e-9;
    // frequency-domain path
    const hp_fft = freqFilter(input, dt, [(w) => Hcr(w, tauCR)]);
    const shaped_fft = freqFilter(input, dt, [(w) => Hcr(w, tauCR), (w) => Hlp(w, tauRC)]);
    // time-domain IIR path (live / causal)
    const hp_iir = iirCR(input, tauCR, dt);
    const shaped_iir = iirRC(hp_iir, tauRC, dt);

    // path agreement (RMS difference, normalised to shaped peak)
    let pk = 1e-12, sse = 0;
    for (let n = 0; n < N; n++) { pk = Math.max(pk, Math.abs(shaped_iir[n])); const d = shaped_iir[n] - shaped_fft[n]; sse += d * d; }
    const rms = Math.sqrt(sse / N) / pk;

    // discriminator on the live shaped output
    const thr = p.thr * pk;
    const { over, edges } = discriminate(shaped_iir, thr);
    const gateS = Math.round(p.gate), vetoS = Math.round(p.veto);
    const { gate, veto, accepted, rejected, pileup } = dualTimer(edges, N, gateS, vetoS);

    // charge integration  (a.u.·ns)
    const Qref = (() => {           // isolated single-pulse reference
      const single = makePulse(N, dt, { t0, tr, tf, amp: p.amp });
      const h = iirRC(iirCR(single, tauCR, dt), tauRC, dt);
      const { edges: e } = discriminate(h, p.thr * Math.max(...h.map(Math.abs)));
      if (!e.length) return 0;
      return sum(h, e[0], Math.min(N, e[0] + gateS)) * dt * 1e9;
    })();
    // naive: integrate a gate at EVERY raw trigger (overlap → double counting)
    let Qnaive = 0;
    for (const e of edges) Qnaive += sum(shaped_iir, e, Math.min(N, e + gateS)) * dt * 1e9;
    // protected: only accepted, non-piled-up events
    let Qprot = 0;
    for (const ev of accepted) if (!ev.pile) Qprot += sum(shaped_iir, ev.start, Math.min(N, ev.gateEnd)) * dt * 1e9;

    // spectra magnitudes (exact: |X·H| = |X|·|H|)
    const re = Float64Array.from(input), im = new Float64Array(N); fft(re, im, false);
    const half = N / 2;
    const magIn = new Float64Array(half), Hc = new Float64Array(half), Hl = new Float64Array(half);
    const magHp = new Float64Array(half), magSh = new Float64Array(half);
    let inMax = 1e-12;
    for (let k = 0; k < half; k++) { magIn[k] = Math.hypot(re[k], im[k]); inMax = Math.max(inMax, magIn[k]); }
    for (let k = 0; k < half; k++) {
      const f = k / (N * dt), w = 2 * Math.PI * f;
      const c = Hcr(w, tauCR), l = Hlp(w, tauRC);
      Hc[k] = Math.hypot(c[0], c[1]); Hl[k] = Math.hypot(l[0], l[1]);
      magIn[k] /= inMax;
      magHp[k] = magIn[k] * Hc[k];
      magSh[k] = magIn[k] * Hc[k] * Hl[k];
    }

    return {
      scope: { input, hp_iir, shaped_iir, hp_fft, shaped_fft, over, gate, veto },
      spec: { in: magIn, hp: magHp, shaped: magSh, Hcr: Hc, Hlp: Hl },
      thr, pk, rms,
      counts: { raw: edges.length, accepted: accepted.length, rejected, pileup },
      Q: { ref: Qref, naive: Qnaive, prot: Qprot },
      windowT: N * dt,
    };
  }, [p]);

  useEffect(() => { fire(); }, [p.dbl, p.sep, p.tauCR, p.tauRC, p.amp, p.tf, p.tr]); // sweep on big changes

  const Qerr = R.Q.ref ? ((R.Q.naive - R.Q.ref) / R.Q.ref) * 100 : 0;

  const panel = { background: C.panel, border: `1px solid ${C.bezel}`, borderRadius: 8 };

  return (
    <div style={{ background: C.bg, minHeight: "100%", color: C.ink, fontFamily: "system-ui, sans-serif", padding: 14 }}>
      <style>{`
        .fdr{-webkit-appearance:none;appearance:none;width:100%;height:3px;background:${C.bezel};border-radius:2px;outline:none}
        .fdr::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#cdd8e4;border:2px solid #0a0d12;cursor:pointer}
        .fdr::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#cdd8e4;border:2px solid #0a0d12;cursor:pointer}
        .seg{display:flex;gap:1px;background:${C.bezel};border-radius:6px;padding:2px}
        .seg button{flex:1;border:0;background:transparent;color:${C.dim};font-size:11px;padding:5px 8px;border-radius:4px;cursor:pointer;letter-spacing:.4px}
        .seg button.on{background:${C.screen};color:${C.ink}}
        @media (prefers-reduced-motion: reduce){*{scroll-behavior:auto}}
      `}</style>

      {/* header plate */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: C.dim, textTransform: "uppercase" }}>Signal Processing Chain</div>
          <div style={{ fontSize: 20, letterSpacing: 1, fontWeight: 600 }}>
            Pulse → <span style={{ color: C.ch2 }}>HPF</span> → <span style={{ color: C.ch4 }}>LPF</span> → Discriminator → <span style={{ color: C.veto }}>Veto</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="seg" style={{ width: 168 }}>
            <button className={!p.dbl ? "on" : ""} onClick={() => set("dbl")(false)}>SINGLE</button>
            <button className={p.dbl ? "on" : ""} onClick={() => set("dbl")(true)}>DOUBLE</button>
          </div>
          <button onClick={fire} style={{ background: C.warn, color: "#1a0b08", border: 0, borderRadius: 6, padding: "8px 16px", fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>FIRE</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
        {/* scopes */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
          <div style={{ ...panel, padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px 8px", fontSize: 10, color: C.dim, letterSpacing: 1 }}>
              <span>TIME DOMAIN · {(R.windowT * 1e6).toFixed(2)} µs · fs = 1 GHz</span>
              <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer", color: p.fftPath ? C.ink : C.dim }}>
                <input type="checkbox" checked={p.fftPath} onChange={(e) => set("fftPath")(e.target.checked)} />
                FFT path overlay (dotted)
              </label>
            </div>
            <div style={{ height: 360, background: C.screen, borderRadius: 5 }}>
              <Scope data={R.scope} dt={dt} threshold={R.thr} sweep={sweep} showFFTpath={p.fftPath} />
            </div>
          </div>

          <div style={{ ...panel, padding: 8 }}>
            <div style={{ padding: "2px 4px 8px", fontSize: 10, color: C.dim, letterSpacing: 1 }}>FREQUENCY DOMAIN · |X(f)| with filter |H(f)| overlay</div>
            <div style={{ height: 190, background: C.screen, borderRadius: 5 }}>
              <Spectrum spec={R.spec} dt={dt} />
            </div>
          </div>
        </div>

        {/* readouts */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
          <Stat label="Triggers (raw)" value={R.counts.raw} color={C.ink} />
          <Stat label="Accepted" value={R.counts.accepted} color={C.ch4} />
          <Stat label="Rejected (veto)" value={R.counts.rejected} color={C.veto} sub={R.counts.pileup ? `${R.counts.pileup} pile-up` : ""} />
          <Stat label="Path agreement" value={(R.rms * 100).toExponential(1) + "%"} color={C.ch2} sub="IIR vs FFT, RMS" />
          <Stat label="Q reference" value={R.Q.ref.toFixed(1)} color={C.dim} sub="single pulse, a.u.·ns" />
          <Stat label="Q naive (no veto)" value={R.Q.naive.toFixed(1)} color={Math.abs(Qerr) > 5 ? C.warn : C.ink} sub={`${Qerr >= 0 ? "+" : ""}${Qerr.toFixed(0)}% vs ref`} />
          <Stat label="Q protected" value={R.Q.prot.toFixed(1)} color={C.ch4} sub="veto + pile-up reject" />
        </div>

        {/* controls */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div style={{ ...panel, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.ch1, marginBottom: 10 }}>● PULSE</div>
            <Fader label="amplitude" value={p.amp} min={0.2} max={2} step={0.05} onChange={set("amp")} fmt={(v) => v.toFixed(2)} color={C.ch1} />
            <Fader label="rise τ" value={p.tr} min={2} max={60} step={1} onChange={set("tr")} fmt={(v) => v + " ns"} color={C.ch1} />
            <Fader label="fall τ" value={p.tf} min={30} max={400} step={5} onChange={set("tf")} fmt={(v) => v + " ns"} color={C.ch1} />
            {p.dbl && <Fader label="2nd-pulse separation" value={p.sep} min={20} max={1500} step={10} onChange={set("sep")} fmt={(v) => v + " ns"} color={C.ch3} />}
          </div>
          <div style={{ ...panel, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.ch2, marginBottom: 10 }}>● SHAPING (CR-RC)</div>
            <Fader label="HPF  τ_CR" value={p.tauCR} min={20} max={600} step={5} onChange={set("tauCR")} fmt={(v) => v + " ns"} color={C.ch2} />
            <Fader label="LPF  τ_RC" value={p.tauRC} min={10} max={300} step={5} onChange={set("tauRC")} fmt={(v) => v + " ns"} color={C.ch4} />
            <Fader label="discriminator threshold" value={p.thr} min={0.05} max={0.9} step={0.01} onChange={set("thr")} fmt={(v) => (v * 100).toFixed(0) + "% pk"} color={C.warn} />
          </div>
          <div style={{ ...panel, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.veto, marginBottom: 10 }}>● DUAL TIMER / VETO</div>
            <Fader label="timer 1 · gate width" value={p.gate} min={50} max={1200} step={10} onChange={set("gate")} fmt={(v) => v + " ns"} color={C.gate} />
            <Fader label="timer 2 · veto (dead time)" value={p.veto} min={50} max={2000} step={10} onChange={set("veto")} fmt={(v) => v + " ns"} color={C.veto} />
            <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.5, marginTop: 6 }}>
              In <b style={{ color: C.ink }}>DOUBLE</b> mode, bring the two pulses within the veto window and watch
              <b style={{ color: C.warn }}> Q naive</b> inflate while <b style={{ color: C.ch4 }}>Q protected</b> stays clean.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   ACQUISITION TAB  —  streaming MCA: events arrive, charge is histogrammed
   ========================================================================= */
function gauss() { // Box–Muller
  let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function RangeFader({ label, lo, hi, min, max, step, onLo, onHi, color }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 0.5, marginBottom: 3 }}>
        <span style={{ color: C.label }}>{label}</span>
        <span style={{ color: color, fontFamily: "ui-monospace, monospace" }}>{lo.toFixed(2)} – {hi.toFixed(2)}</span>
      </div>
      <input className="fdr" type="range" min={min} max={max} step={step} value={lo}
        onChange={(e) => onLo(Math.min(parseFloat(e.target.value), hi - step))} style={{ accentColor: color, marginBottom: 4 }} />
      <input className="fdr" type="range" min={min} max={max} step={step} value={hi}
        onChange={(e) => onHi(Math.max(parseFloat(e.target.value), lo + step))} style={{ accentColor: color }} />
    </div>
  );
}

function LiveScope({ stateRef, sceneWinNs, thrFrac, pkU, dtR, ampHi, gateNs, vetoNs, mode }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const TRIG_F = 0.34; // trigger line sits this fraction from the left
    const draw = () => {
      const cv = ref.current; if (!cv) { raf = requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const S = stateRef.current; const sU = S.sU;
      const padL = 8, padR = 8, padT = 8, padB = 8;
      const pw = W - padL - padR, ph = H - padT - padB;
      const winT = sceneWinNs * 1e-9, Lr = sU.length * dtR;

      // window anchoring: TRIG → align crossing to the trigger line; ROLL → free scroll
      const trig = mode === "trig" && S.lastTrigT != null;
      const t0 = trig ? S.lastTrigT - TRIG_F * winT : S.simTime - winT;
      const t1 = t0 + winT;
      const tToX = (t) => padL + ((t - t0) / winT) * pw;
      const xClamp = (x) => Math.max(padL, Math.min(padL + pw, x));

      // FIXED vertical scale → threshold line stays put as you adjust it
      const mx = Math.max(thrFrac * pkU * 1.5, ampHi * pkU * 1.18);
      const baseY = padT + ph * 0.84;
      const yAt = (v) => baseY - (v / mx) * ph * 0.74;
      const yThr = yAt(thrFrac * pkU);

      // gate / veto windows anchored at the trigger
      if (trig) {
        const xg0 = tToX(S.lastTrigT);
        g.fillStyle = "rgba(255,77,77,0.10)";
        g.fillRect(xClamp(xg0), padT, xClamp(tToX(S.lastTrigT + vetoNs * 1e-9)) - xClamp(xg0), ph);
        g.fillStyle = "rgba(122,217,107,0.13)";
        g.fillRect(xClamp(xg0), padT, xClamp(tToX(S.lastTrigT + gateNs * 1e-9)) - xClamp(xg0), ph);
        g.fillStyle = "rgba(122,217,107,0.7)"; g.font = "8px ui-monospace, monospace"; g.textAlign = "left";
        g.fillText("gate", xClamp(xg0) + 3, padT + ph - 4);
        g.fillStyle = "rgba(255,77,77,0.7)";
        g.fillText("veto", xClamp(tToX(S.lastTrigT + gateNs * 1e-9)) + 3, padT + ph - 4);
      }

      // shaped stream
      const M = Math.max(64, Math.floor(pw));
      const ys = new Float64Array(M);
      for (const e of S.evt) {
        if (e.t > t1 || e.t + Lr < t0) continue;
        for (let i = 0; i < M; i++) {
          const t = t0 + (i / (M - 1)) * winT, u = (t - e.t) / dtR;
          if (u < 0 || u >= sU.length - 1) continue;
          const k = u | 0; ys[i] += e.A * (sU[k] + (sU[k + 1] - sU[k]) * (u - k));
        }
      }

      // threshold dashed line
      g.strokeStyle = "rgba(255,107,94,0.6)"; g.setLineDash([5, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(padL, yThr); g.lineTo(padL + pw, yThr); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(255,107,94,0.85)"; g.font = "8px ui-monospace, monospace"; g.textAlign = "left";
      g.fillText("thr " + (thrFrac * 100).toFixed(0) + "%", padL + 2, yThr - 3);

      // trigger line + crossing dot
      if (trig) {
        const xt = tToX(S.lastTrigT);
        g.strokeStyle = "rgba(201,212,224,0.55)"; g.setLineDash([2, 3]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(xt, padT); g.lineTo(xt, padT + ph); g.stroke(); g.setLineDash([]);
        g.fillStyle = C.ink; g.textAlign = "center"; g.font = "8px ui-monospace, monospace";
        g.fillText("TRIG", xt, padT + 8);
        g.fillStyle = C.ch4; g.beginPath(); g.arc(xt, yThr, 2.6, 0, 7); g.fill();
      }

      // trace
      g.strokeStyle = C.ch4; g.lineWidth = 1.3; g.shadowColor = C.ch4; g.shadowBlur = 5;
      g.beginPath();
      for (let i = 0; i < M; i++) { const x = padL + (i / (M - 1)) * pw, y = yAt(ys[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.shadowBlur = 0;

      // arrival ticks
      for (const e of S.evt) {
        if (e.t < t0 || e.t > t1) continue;
        const x = tToX(e.t);
        g.strokeStyle = e.accepted ? C.ch4 : C.veto; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, baseY + 4); g.lineTo(x, baseY + 9); g.stroke();
      }
      g.fillStyle = C.dim; g.font = "9px ui-monospace, monospace"; g.textAlign = "right";
      g.fillText(`${trig ? "TRIG" : "ROLL"} · ${(winT * 1e6).toFixed(1)} µs`, padL + pw, padT + 9);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sceneWinNs, thrFrac, pkU, dtR, ampHi, gateNs, vetoNs, mode]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function Histogram({ stateRef, mode, chargeMax, ampLines }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const draw = () => {
      const cv = ref.current; if (!cv) { raf = requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const S = stateRef.current;
      const hist = mode === "naive" ? S.histNaive : S.histProt;
      const bins = hist.length;
      const padL = 40, padR = 8, padT = 10, padB = 18;
      const pw = W - padL - padR, ph = H - padT - padB;
      let mx = 1; for (let i = 0; i < bins; i++) mx = Math.max(mx, hist[i]);
      const color = mode === "naive" ? C.warn : C.ch4;
      // grid
      g.strokeStyle = C.grid; g.lineWidth = 1; g.font = "8px ui-monospace, monospace";
      g.fillStyle = C.dim; g.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const y = padT + (i / 4) * ph, v = Math.round(mx * (1 - i / 4));
        g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + pw, y); g.stroke();
        g.fillText(v, padL - 3, y + 3);
      }
      g.textAlign = "center";
      for (let i = 0; i <= 4; i++) {
        const x = padL + (i / 4) * pw, q = (i / 4) * chargeMax;
        g.fillText(q.toFixed(0), x, H - 5);
      }
      // expected line positions
      if (ampLines) for (const q of ampLines) {
        const x = padL + (q / chargeMax) * pw;
        g.strokeStyle = "rgba(63,208,216,0.35)"; g.setLineDash([3, 3]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + ph); g.stroke(); g.setLineDash([]);
      }
      // bars
      g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 4;
      const bw = pw / bins;
      for (let i = 0; i < bins; i++) {
        const h = (hist[i] / mx) * ph;
        if (h > 0) g.fillRect(padL + i * bw, padT + ph - h, Math.max(1, bw - 0.3), h);
      }
      g.shadowBlur = 0;
      g.fillStyle = color; g.font = "9px ui-monospace, monospace"; g.textAlign = "left";
      g.fillText(`${mode === "naive" ? "NAIVE (no pile-up reject)" : "PROTECTED"} · channel = charge (a.u.·ns)`, padL + 4, padT + 9);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode, chargeMax, ampLines]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function AcquisitionTab() {
  const dtR = 1e-9;
  const BINS = 240;
  const [q, setQ] = useState({
    rate: 5e4, speed: 1, running: true,
    ampLo: 0.2, ampHi: 1.6, dist: "uniform", noise: 0.04,
    tauCR: 200, tauRC: 50, gate: 300, veto: 600, thr: 0.30,
    mode: "protected", scopeMode: "trig",
  });
  const setk = (k) => (v) => setQ((s) => ({ ...s, [k]: v }));
  const [, force] = useState(0);

  // ---- precompute the unit shaped response + cumulative integral ----
  const resp = useMemo(() => {
    const tauCR = q.tauCR * 1e-9, tauRC = q.tauRC * 1e-9;
    const Lns = q.gate + 6 * Math.max(q.tauCR, q.tauRC, 100) + 200;
    const Lr = Math.min(8192, Math.ceil(Lns));
    const inp = makePulse(Lr, dtR, { t0: 0, tr: 10e-9, tf: 100e-9, amp: 1 });
    const sU = iirRC(iirCR(inp, tauCR, dtR), tauRC, dtR);
    let pkU = 0; for (let i = 0; i < Lr; i++) pkU = Math.max(pkU, sU[i]);
    const CU = new Float64Array(Lr + 1);
    for (let i = 0; i < Lr; i++) CU[i + 1] = CU[i] + sU[i] * dtR * 1e9; // a.u.·ns
    return { sU, pkU, CU, Lr };
  }, [q.tauCR, q.tauRC, q.gate]);

  // ---- persistent acquisition state ----
  const stateRef = useRef(null);
  if (!stateRef.current) stateRef.current = {
    sU: resp.sU, evt: [], simTime: 0, nextT: 0, vetoEnd: -1, gateEnd: -1, curIdx: -1, lastTrigT: null,
    histProt: new Float64Array(BINS), histNaive: new Float64Array(BINS),
    counts: { total: 0, acc: 0, rej: 0, pile: 0, sub: 0 }, finPtr: 0,
  };
  stateRef.current.sU = resp.sU;

  // charge of an isolated unit-amplitude event (gain G), at the high end of range
  const gateS = Math.round(q.gate);
  const crossIdx = useCallback((A) => {
    const { sU, pkU } = resp; const th = q.thr * pkU;
    for (let i = 1; i < sU.length; i++) if (A * sU[i] >= th && A * sU[i - 1] < th) return i;
    return -1;
  }, [resp, q.thr]);
  const eventCharge = useCallback((A, idx) => {
    // sum over neighbours overlapping event idx's gate
    const S = stateRef.current; const { CU, Lr } = resp;
    const ev = S.evt[idx]; if (!ev) return 0;
    const ic = ev.ic; if (ic < 0) return 0;
    const gStart = ev.t + ic * dtR, gEnd = gStart + gateS * dtR;
    let Q = 0;
    for (let j = Math.max(0, idx - 40); j < S.evt.length; j++) {
      const e2 = S.evt[j]; const d = e2.t;
      let u1 = (gStart - d) / dtR, u2 = (gEnd - d) / dtR;
      if (u2 <= 0 || u1 >= Lr) continue;
      u1 = Math.max(0, u1); u2 = Math.min(Lr, u2);
      Q += e2.A * (CU[Math.round(u2)] - CU[Math.round(u1)]);
    }
    return Q;
  }, [resp, gateS]);

  const Gunit = useMemo(() => {
    const { CU } = resp; const ic = crossIdx(1); if (ic < 0) return 0;
    return CU[Math.min(CU.length - 1, ic + gateS)] - CU[ic];
  }, [resp, crossIdx, gateS]);
  const chargeMax = Math.max(1, q.ampHi * Gunit * 2.2);

  const clearAcq = useCallback(() => {
    const S = stateRef.current;
    S.evt = []; S.simTime = 0; S.nextT = 0; S.vetoEnd = -1; S.gateEnd = -1; S.curIdx = -1; S.finPtr = 0; S.lastTrigT = null;
    S.histProt = new Float64Array(BINS); S.histNaive = new Float64Array(BINS);
    S.counts = { total: 0, acc: 0, rej: 0, pile: 0, sub: 0 };
  }, []);
  // re-acquire when the gain/axis-defining settings change
  useEffect(() => { clearAcq(); }, [q.tauCR, q.tauRC, q.gate, q.thr, q.ampLo, q.ampHi, q.dist, q.noise, clearAcq]);

  const sampleAmp = useCallback(() => {
    if (q.dist === "lines") {
      const span = q.ampHi - q.ampLo;
      const centers = [q.ampLo + span * 0.45, q.ampLo + span * 0.82];
      const c = centers[Math.random() < 0.6 ? 0 : 1];
      let a = c + gauss() * span * 0.035;
      return Math.max(q.ampLo, Math.min(q.ampHi, a));
    }
    return q.ampLo + Math.random() * (q.ampHi - q.ampLo);
  }, [q.dist, q.ampLo, q.ampHi]);

  // ---- the acquisition loop ----
  useEffect(() => {
    if (!q.running) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const S = stateRef.current;
      const frameDt = Math.min(0.05, (now - last) / 1000); last = now;
      let dExp = q.speed * frameDt;                 // simulated seconds this frame
      const rate = q.rate, vetoT = q.veto * 1e-9;
      const tEnd = S.simTime + dExp;
      let made = 0, capped = false;
      // Poisson arrivals
      while (S.nextT < tEnd) {
        if (made >= 6000) { capped = true; break; }
        const t = S.nextT;
        const A = sampleAmp();
        const idx = S.evt.length;
        const ic = crossIdx(A);
        const ev = { t, A, ic, accepted: false, piled: false, done: false };
        S.evt.push(ev);
        if (ic < 0) { S.counts.sub++; }            // sub-threshold: no trigger (still contributes signal)
        else if (t < S.vetoEnd) {                  // inside dead time → rejected
          S.counts.rej++;
          if (t < S.gateEnd && S.curIdx >= 0 && !S.evt[S.curIdx].piled) { S.evt[S.curIdx].piled = true; S.counts.pile++; }
        } else {                                   // accepted
          ev.accepted = true; S.counts.total++; S.counts.acc++;
          S.gateEnd = t + (ic + gateS) * dtR; S.vetoEnd = t + vetoT; S.curIdx = idx;
          S.lastTrigT = t + ic * dtR;            // absolute threshold-crossing time
        }
        made++;
        S.nextT += -Math.log(1 - Math.random()) / rate; // exponential inter-arrival
      }
      S.simTime = capped ? S.nextT : tEnd;
      // finalize accepted events whose gate has fully passed
      const guard = (resp.Lr) * dtR;
      while (S.finPtr < S.evt.length) {
        const e = S.evt[S.finPtr];
        if (e.t + (e.ic + gateS) * dtR > S.simTime - guard) break;
        if (e.accepted && !e.done) {
          let Qc = eventCharge(e.A, S.finPtr) + gauss() * q.noise * Gunit; // measured charge
          const bin = Math.max(0, Math.min(BINS - 1, Math.floor((Qc / chargeMax) * BINS)));
          S.histNaive[bin]++;
          if (!e.piled) S.histProt[bin]++;        // protected: keep only clean events
          e.done = true;
        }
        S.finPtr++;
      }
      // prune old events (keep recent window for scope + overlap)
      const keepFrom = S.simTime - (guard + 6e-6);
      if (S.finPtr > 200) {
        let drop = 0; while (drop < S.finPtr && S.evt[drop].t < keepFrom) drop++;
        if (drop > 0) { S.evt.splice(0, drop); S.finPtr -= drop; if (S.curIdx >= 0) S.curIdx -= drop; }
      }
      force((x) => x + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [q.running, q.speed, q.rate, q.veto, q.noise, sampleAmp, crossIdx, eventCharge, Gunit, chargeMax, gateS, resp.Lr]);

  const randomize = () => setQ((s) => ({
    ...s,
    rate: Math.round(Math.pow(10, 3 + Math.random() * 2.7)),
    tauCR: 20 + Math.round(Math.random() * 580),
    tauRC: 10 + Math.round(Math.random() * 290),
    gate: 50 + Math.round(Math.random() * 700),
    veto: 50 + Math.round(Math.random() * 1500),
    thr: +(0.08 + Math.random() * 0.5).toFixed(2),
    noise: +(Math.random() * 0.12).toFixed(3),
  }));

  const S = stateRef.current;
  const lr = S.simTime > 0 ? S.counts.acc / S.simTime : 0;       // live output rate
  const dead = S.simTime > 0 ? Math.min(100, 100 * S.counts.acc * q.veto * 1e-9 / S.simTime) : 0;
  const thru = S.counts.total + S.counts.rej + S.counts.sub > 0 ? 100 * S.counts.acc / (S.counts.total + S.counts.rej) : 0;
  const ampLines = q.dist === "lines"
    ? [(q.ampLo + (q.ampHi - q.ampLo) * 0.45) * Gunit, (q.ampLo + (q.ampHi - q.ampLo) * 0.82) * Gunit]
    : null;
  const panel = { background: C.panel, border: `1px solid ${C.bezel}`, borderRadius: 8 };

  return (
    <div style={{ color: C.ink, fontFamily: "system-ui, sans-serif", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: C.dim, textTransform: "uppercase" }}>Multichannel Acquisition</div>
          <div style={{ fontSize: 20, letterSpacing: 1, fontWeight: 600 }}>Live pulse-height spectrum</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setk("running")(!q.running)} style={{ background: q.running ? C.bezel : C.ch4, color: q.running ? C.ink : "#06140a", border: 0, borderRadius: 6, padding: "8px 16px", fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>{q.running ? "❚❚ PAUSE" : "▶ RUN"}</button>
          <button onClick={clearAcq} style={{ background: "transparent", color: C.dim, border: `1px solid ${C.bezel}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}>CLEAR</button>
          <button onClick={randomize} style={{ background: "transparent", color: C.ch1, border: `1px solid ${C.bezel}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}>🎲 RANDOMIZE</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
        <div style={{ ...panel, padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px 8px", fontSize: 10, color: C.dim, letterSpacing: 1 }}>
            <span>DETECTOR STREAM · shaped output</span>
            <span className="seg" style={{ width: 150 }}>
              <button className={q.scopeMode === "trig" ? "on" : ""} onClick={() => setk("scopeMode")("trig")}>TRIG</button>
              <button className={q.scopeMode === "roll" ? "on" : ""} onClick={() => setk("scopeMode")("roll")}>ROLL</button>
            </span>
          </div>
          <div style={{ height: 150, background: C.screen, borderRadius: 5 }}>
            <LiveScope stateRef={stateRef} sceneWinNs={2200} thrFrac={q.thr} pkU={resp.pkU} dtR={dtR}
              ampHi={q.ampHi} gateNs={q.gate} vetoNs={q.veto} mode={q.scopeMode} />
          </div>
        </div>

        <div style={{ ...panel, padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px 8px", fontSize: 10, color: C.dim, letterSpacing: 1 }}>
            <span>PULSE-HEIGHT HISTOGRAM</span>
            <span className="seg" style={{ width: 220 }}>
              <button className={q.mode === "protected" ? "on" : ""} onClick={() => setk("mode")("protected")}>PROTECTED</button>
              <button className={q.mode === "naive" ? "on" : ""} onClick={() => setk("mode")("naive")}>NAIVE</button>
            </span>
          </div>
          <div style={{ height: 240, background: C.screen, borderRadius: 5 }}>
            <Histogram stateRef={stateRef} mode={q.mode} chargeMax={chargeMax} ampLines={ampLines} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
          <Stat label="Elapsed (sim)" value={S.simTime < 1e-3 ? (S.simTime * 1e6).toFixed(0) + " µs" : (S.simTime * 1e3).toFixed(1) + " ms"} />
          <Stat label="Counts" value={S.counts.acc} color={C.ch4} />
          <Stat label="Output rate" value={lr >= 1e3 ? (lr / 1e3).toFixed(1) + "k/s" : lr.toFixed(0) + "/s"} color={C.ch2} />
          <Stat label="Rejected" value={S.counts.rej} color={C.veto} sub={`${S.counts.pile} pile-up`} />
          <Stat label="Sub-threshold" value={S.counts.sub} color={C.dim} />
          <Stat label="Dead time" value={dead.toFixed(0) + "%"} color={dead > 30 ? C.warn : C.ink} />
          <Stat label="Throughput" value={thru.toFixed(0) + "%"} color={thru < 70 ? C.warn : C.ch4} sub="acc / triggers" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div style={{ ...panel, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.ch1, marginBottom: 10 }}>● SOURCE</div>
            <Fader label="event rate" value={q.rate} min={3} max={5.7} step={0.05}
              onChange={(v) => setk("rate")(Math.round(Math.pow(10, v)))} fmt={() => (q.rate >= 1e3 ? (q.rate / 1e3).toFixed(1) + "k/s" : q.rate + "/s")} color={C.ch1} />
            <RangeFader label="amplitude range" lo={q.ampLo} hi={q.ampHi} min={0.05} max={2} step={0.05} onLo={setk("ampLo")} onHi={setk("ampHi")} color={C.ch1} />
            <div className="seg" style={{ marginBottom: 10 }}>
              <button className={q.dist === "uniform" ? "on" : ""} onClick={() => setk("dist")("uniform")}>UNIFORM</button>
              <button className={q.dist === "lines" ? "on" : ""} onClick={() => setk("dist")("lines")}>LINES</button>
            </div>
            <Fader label="electronic noise σ" value={q.noise} min={0} max={0.15} step={0.005} onChange={setk("noise")} fmt={(v) => (v * 100).toFixed(1) + "%"} color={C.ch3} />
          </div>
          <div style={{ ...panel, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.ch2, marginBottom: 10 }}>● SHAPING + TRIGGER</div>
            <Fader label="HPF  τ_CR" value={q.tauCR} min={20} max={600} step={5} onChange={setk("tauCR")} fmt={(v) => v + " ns"} color={C.ch2} />
            <Fader label="LPF  τ_RC" value={q.tauRC} min={10} max={300} step={5} onChange={setk("tauRC")} fmt={(v) => v + " ns"} color={C.ch4} />
            <Fader label="threshold" value={q.thr} min={0.05} max={0.7} step={0.01} onChange={setk("thr")} fmt={(v) => (v * 100).toFixed(0) + "% pk"} color={C.warn} />
          </div>
          <div style={{ ...panel, padding: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: C.veto, marginBottom: 10 }}>● TIMING + DISPLAY</div>
            <Fader label="gate width" value={q.gate} min={50} max={1200} step={10} onChange={setk("gate")} fmt={(v) => v + " ns"} color={C.gate} />
            <Fader label="veto (dead time)" value={q.veto} min={50} max={2000} step={10} onChange={setk("veto")} fmt={(v) => v + " ns"} color={C.veto} />
            <Fader label="sim speed" value={Math.log10(q.speed)} min={-1} max={1.3} step={0.05} onChange={(v) => setk("speed")(+Math.pow(10, v).toFixed(2))} fmt={() => q.speed + "×"} color={C.ink} />
            <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>
              Push <b style={{ color: C.ink }}>rate</b> up and switch <b style={{ color: C.warn }}>NAIVE</b> ↔ <b style={{ color: C.ch4 }}>PROTECTED</b>:
              pile-up smears the naive spectrum toward higher channels while protected stays sharp.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   APP SHELL  —  tab switch
   ========================================================================= */
export default function App() {
  const [tab, setTab] = useState("analyzer");
  return (
    <div style={{ background: C.bg, minHeight: "100%", color: C.ink, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        .fdr{-webkit-appearance:none;appearance:none;width:100%;height:3px;background:${C.bezel};border-radius:2px;outline:none}
        .fdr::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#cdd8e4;border:2px solid #0a0d12;cursor:pointer}
        .fdr::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#cdd8e4;border:2px solid #0a0d12;cursor:pointer}
        .seg{display:flex;gap:1px;background:${C.bezel};border-radius:6px;padding:2px}
        .seg button{flex:1;border:0;background:transparent;color:${C.dim};font-size:11px;padding:5px 8px;border-radius:4px;cursor:pointer;letter-spacing:.4px}
        .seg button.on{background:${C.screen};color:${C.ink}}
      `}</style>
      <div style={{ display: "flex", gap: 2, padding: "10px 14px 0", borderBottom: `1px solid ${C.bezel}` }}>
        {[["analyzer", "① ANALYZER"], ["acquisition", "② ACQUISITION"]].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            border: 0, borderBottom: `2px solid ${tab === k ? C.ch2 : "transparent"}`,
            background: "transparent", color: tab === k ? C.ink : C.dim,
            fontSize: 12, letterSpacing: 1, padding: "8px 16px", cursor: "pointer", fontWeight: 600,
          }}>{t}</button>
        ))}
      </div>
      {tab === "analyzer" ? <AnalyzerTab /> : <AcquisitionTab />}
    </div>
  );
}
