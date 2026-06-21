'use client';

import React, { useState, useMemo, useEffect } from "react";

/* =========================================================================
   중력가속도 가상 실험실  —  오실로스코프 / 실험노트 컨셉
   x축: 낙하시간 t (스톱워치 오차)   y축: 높이 h (줄자 오차)
   h = a·t² (+ b·t + c)  를 가중 최소제곱으로 피팅 → g = 2a
   ========================================================================= */

const C = {
  bg: "#eceeec",
  card: "#ffffff",
  border: "#d9ddda",
  ink: "#1a2024",
  sub: "#5d646b",
  faint: "#9aa0a8",
  paper: "#f8faf8",
  grid: "#e4e8e4",
  gridMinor: "#eef1ee",
  signal: "#0a8f86",
  signalSoft: "rgba(10,143,134,0.13)",
  data: "#2a3036",
  truth: "#8a5cf0",
  display: "#11171a",
  displayInk: "#3cf0d6",
  warn: "#d6643a",
};
const MONO = 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace';
const SANS = '-apple-system, "Segoe UI", Roboto, system-ui, "Helvetica Neue", sans-serif';

/* ======================= 타입 ======================= */
interface Params {
  swRes: number;
  rulerRes: number;
  jitter: number;
  bias: number;
  vt: number;
  trials: number;
}

interface HeightRecord {
  id: number;
  trueV: number;
  measV: number;
  times: number[];
}

interface DataRow {
  id: number;
  trueV: number;
  t: number;
  h: number;
  st: number;
  sh: number;
  N: number;
  sd: number;
}

interface FitResult {
  coeffs: number[];
  cov: number[][];
  chi2: number;
  dof: number;
  g: number;
  sg: number;
  model: (t: number) => number;
  bandSd: (t: number) => number;
  p: number;
}

interface BasisEntry {
  fn: (t: number) => number[];
  p: number;
  label: string;
  note: string;
}

/* ======================= 수학 / 물리 ======================= */
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const fallVac = (h: number, g: number): number => Math.sqrt((2 * h) / g);
const arccosh = (x: number): number => Math.log(x + Math.sqrt(x * x - 1));
function fallDrag(h: number, g: number, vt: number): number {
  if (!isFinite(vt) || vt > 1e5) return fallVac(h, g);
  const ex = Math.exp((h * g) / (vt * vt));
  return (vt / g) * arccosh(ex);
}
const quant = (x: number, step: number): number =>
  step > 0 ? Math.round(x / step) * step : x;

function matInv(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((r, i) => [
    ...r,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-15) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r) => r.slice(n));
}
const matVec = (A: number[][], v: number[]): number[] =>
  A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0));

const BASIS: Record<string, BasisEntry> = {
  full:     { fn: (t) => [t * t, t, 1], p: 3, label: "h = a·t² + b·t + c", note: "반응시간 오프셋을 흡수(가장 일반적)" },
  noLinear: { fn: (t) => [t * t, 1],    p: 2, label: "h = a·t² + c",        note: "상수 높이 오프셋만 보정" },
  pure:     { fn: (t) => [t * t],       p: 1, label: "h = a·t²",            note: "이상적 자유낙하 가정(편향 위험)" },
};

function weightedFit(
  points: { t: number; h: number; st: number; sh: number }[],
  basisKey: string
): FitResult | null {
  const B = BASIS[basisKey];
  const p = B.p;
  const distinct = new Set(points.map((q) => q.t.toFixed(6))).size;
  if (points.length < p || distinct < p) return null;

  let coeffs = new Array<number>(p).fill(0);
  let cov: number[][] | null = null;
  for (let it = 0; it < 5; it++) {
    const rows = points.map((pt) => {
      const X = B.fn(pt.t);
      const dt = 1e-4;
      const m1 = B.fn(pt.t + dt).reduce((s, x, j) => s + x * coeffs[j], 0);
      const m0 = B.fn(pt.t - dt).reduce((s, x, j) => s + x * coeffs[j], 0);
      const deriv = (m1 - m0) / (2 * dt);
      const seff2 = pt.sh * pt.sh + deriv * deriv * pt.st * pt.st;
      return { X, y: pt.h, w: 1 / Math.max(seff2, 1e-12) };
    });
    const XtWX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const XtWy = new Array<number>(p).fill(0);
    for (const r of rows)
      for (let i = 0; i < p; i++) {
        XtWy[i] += r.X[i] * r.w * r.y;
        for (let j = 0; j < p; j++) XtWX[i][j] += r.X[i] * r.w * r.X[j];
      }
    cov = matInv(XtWX);
    if (!cov) return null;
    coeffs = matVec(cov, XtWy);
  }
  if (!cov) return null;

  let chi2 = 0;
  for (const pt of points) {
    const m = B.fn(pt.t).reduce((s, x, j) => s + x * coeffs[j], 0);
    const dt = 1e-4;
    const d =
      (B.fn(pt.t + dt).reduce((s, x, j) => s + x * coeffs[j], 0) -
        B.fn(pt.t - dt).reduce((s, x, j) => s + x * coeffs[j], 0)) /
      (2 * dt);
    const seff2 = pt.sh * pt.sh + d * d * pt.st * pt.st;
    chi2 += ((pt.h - m) * (pt.h - m)) / Math.max(seff2, 1e-12);
  }
  const dof = Math.max(points.length - p, 1);
  const a = coeffs[0];
  const varA = cov[0][0];
  const g = 2 * a;
  const sg = 2 * Math.sqrt(Math.max(varA, 0));
  const finalCov = cov;
  const model = (t: number) => B.fn(t).reduce((s, x, j) => s + x * coeffs[j], 0);
  const bandSd = (t: number) => {
    const J = B.fn(t);
    let v = 0;
    for (let i = 0; i < p; i++)
      for (let j = 0; j < p; j++) v += J[i] * finalCov[i][j] * J[j];
    return Math.sqrt(Math.max(v, 0));
  };
  return { coeffs, cov, chi2, dof, g, sg, model, bandSd, p };
}

/* ======================= 시뮬레이션 ======================= */
function sampleTime(trueRealT: number, params: Params): number {
  const jitter = params.jitter * gauss();
  const bias = params.bias;
  let t = trueRealT + bias + jitter;
  if (t < 0) t = 0;
  return quant(t, params.swRes);
}
function sampleHeight(trueH: number, params: Params): number {
  const read = (params.rulerRes / 2) * gauss();
  const h = trueH + read;
  return quant(h, params.rulerRes);
}
function heightSigma(params: Params): number {
  const single = params.rulerRes / 2;
  return Math.SQRT2 * single;
}

/* ======================= 작은 UI 부품 ======================= */
function Card({
  title,
  eyebrow,
  right,
  children,
  style,
}: {
  title?: string;
  eyebrow?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        ...style,
      }}
    >
      {(title || eyebrow) && (
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "13px 16px 10px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div>
            {eyebrow && (
              <div
                style={{
                  font: `600 10px/1.4 ${SANS}`,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: C.signal,
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                style={{
                  margin: "2px 0 0",
                  font: `600 15px/1.25 ${SANS}`,
                  color: C.ink,
                }}
              >
                {title}
              </h2>
            )}
          </div>
          {right}
        </header>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span style={{ font: `600 12px/1 ${SANS}`, color: C.ink }}>{label}</span>
        {hint && (
          <span style={{ font: `500 11px/1 ${MONO}`, color: C.sub }}>{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}

const selStyle: React.CSSProperties = {
  width: "100%",
  appearance: "none",
  font: `500 13px ${SANS}`,
  color: C.ink,
  background: C.paper,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "8px 10px",
};

function Seg({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string; title?: string }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: C.paper,
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            title={o.title || ""}
            style={{
              flex: 1,
              cursor: "pointer",
              border: "none",
              borderRadius: 6,
              padding: "7px 4px",
              font: `600 12px ${SANS}`,
              color: on ? "#fff" : C.sub,
              background: on ? C.signal : "transparent",
              transition: "all .12s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Btn({
  children,
  onClick,
  kind = "ghost",
  disabled,
  full,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "solid" | "ghost";
  disabled?: boolean;
  full?: boolean;
}) {
  const base: React.CSSProperties = {
    cursor: disabled ? "default" : "pointer",
    border: "1px solid",
    borderRadius: 9,
    padding: "9px 12px",
    font: `600 13px ${SANS}`,
    transition: "all .12s",
    width: full ? "100%" : "auto",
    opacity: disabled ? 0.45 : 1,
  };
  const kinds = {
    primary: { background: C.signal, color: "#fff", borderColor: C.signal },
    solid:   { background: C.ink, color: "#fff", borderColor: C.ink },
    ghost:   { background: C.card, color: C.ink, borderColor: C.border },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...kinds[kind] }}
    >
      {children}
    </button>
  );
}

/* ======================= 메인 그래프 ======================= */
function Plot({
  rows,
  fit,
  view,
  showTrue,
  params,
  gTrue,
}: {
  rows: DataRow[];
  fit: FitResult | null;
  view: string;
  showTrue: boolean;
  params: Params;
  gTrue: number;
}) {
  const W = 660, H = 460, m = { l: 64, r: 18, t: 18, b: 52 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;

  const xOf = (t: number) => (view === "linear" ? t * t : t);
  const sxOf = (t: number, st: number) => (view === "linear" ? 2 * t * st : st);

  const xs: number[] = [], ys: number[] = [];
  rows.forEach((r) => {
    xs.push(xOf(r.t) + sxOf(r.t, r.st), xOf(r.t) - sxOf(r.t, r.st));
    ys.push(r.h + r.sh, r.h - r.sh);
  });
  let tGrid: number[] = [];
  if (fit || showTrue || rows.length) {
    const tmax = Math.max(0.2, ...rows.map((r) => r.t)) * 1.12;
    for (let i = 0; i <= 80; i++) tGrid.push((tmax * i) / 80);
    tGrid.forEach((t) => { xs.push(xOf(t)); });
  }
  const curve = fit ? tGrid.map((t) => ({ t, y: fit.model(t), sd: fit.bandSd(t) })) : [];
  curve.forEach((c) => ys.push(c.y + c.sd, c.y - c.sd));
  const trueCurve = showTrue
    ? tGrid.map((t) => ({ t, y: 0.5 * gTrue * t * t }))
    : [];
  trueCurve.forEach((c) => ys.push(c.y));

  let xmin = Math.min(0, ...xs), xmax = Math.max(...xs, 0.1);
  let ymin = Math.min(0, ...ys), ymax = Math.max(...ys, 0.1);
  if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
  const xpad = (xmax - xmin) * 0.04 || 0.05, ypad = (ymax - ymin) * 0.06 || 0.05;
  xmin -= xpad; xmax += xpad; ymin = Math.min(0, ymin); ymax += ypad;

  const X = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * pw;
  const Y = (y: number) => m.t + ph - ((y - ymin) / (ymax - ymin)) * ph;

  const ticks = (lo: number, hi: number, n = 5) => {
    const span = hi - lo, raw = span / n;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= raw) || pow;
    const out: number[] = [];
    let v = Math.ceil(lo / step) * step;
    while (v <= hi + 1e-9) { out.push(+v.toFixed(6)); v += step; }
    return out;
  };
  const xt = ticks(xmin, xmax), yt = ticks(ymin, ymax);

  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const bandUp = curve.map((c) => ({ x: xOf(c.t), y: c.y + c.sd }));
  const bandDn = curve.map((c) => ({ x: xOf(c.t), y: c.y - c.sd })).reverse();
  const bandPath = curve.length
    ? path(bandUp) + " " + bandDn.map((p) => `L${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ") + " Z"
    : "";

  const xLabel = view === "linear" ? "시간²  t²  (s²)" : "낙하시간  t  (s)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        background: C.paper,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
      }}
    >
      {xt.map((t, i) => (
        <line key={"gx" + i} x1={X(t)} x2={X(t)} y1={m.t} y2={m.t + ph} stroke={C.gridMinor} />
      ))}
      {yt.map((t, i) => (
        <line key={"gy" + i} x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={C.grid} />
      ))}
      <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke={C.ink} strokeWidth="1.4" />
      <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + ph} stroke={C.ink} strokeWidth="1.4" />
      {xt.map((t, i) => (
        <g key={"xt" + i}>
          <line x1={X(t)} x2={X(t)} y1={m.t + ph} y2={m.t + ph + 5} stroke={C.ink} />
          <text x={X(t)} y={m.t + ph + 18} textAnchor="middle" style={{ font: `500 11px ${MONO}`, fill: C.sub }}>{t}</text>
        </g>
      ))}
      {yt.map((t, i) => (
        <g key={"yt" + i}>
          <line x1={m.l - 5} x2={m.l} y1={Y(t)} y2={Y(t)} stroke={C.ink} />
          <text x={m.l - 9} y={Y(t) + 3.5} textAnchor="end" style={{ font: `500 11px ${MONO}`, fill: C.sub }}>{t}</text>
        </g>
      ))}
      <text x={m.l + pw / 2} y={H - 8} textAnchor="middle" style={{ font: `600 12px ${SANS}`, fill: C.ink }}>{xLabel}</text>
      <text transform={`translate(15 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" style={{ font: `600 12px ${SANS}`, fill: C.ink }}>높이  h  (m)</text>

      {bandPath && <path d={bandPath} fill={C.signalSoft} stroke="none" />}
      {showTrue && trueCurve.length > 1 && (
        <path
          d={path(trueCurve.map((c) => ({ x: xOf(c.t), y: c.y })))}
          fill="none"
          stroke={C.truth}
          strokeWidth="1.6"
          strokeDasharray="5 4"
        />
      )}
      {fit && curve.length > 1 && (
        <path
          d={path(curve.map((c) => ({ x: xOf(c.t), y: c.y })))}
          fill="none"
          stroke={C.signal}
          strokeWidth="2.2"
        />
      )}
      {rows.map((r, i) => {
        const cx = X(xOf(r.t)), cy = Y(r.h);
        const exL = X(xOf(r.t) - sxOf(r.t, r.st)), exR = X(xOf(r.t) + sxOf(r.t, r.st));
        const eyU = Y(r.h + r.sh), eyD = Y(r.h - r.sh);
        return (
          <g key={"pt" + i}>
            <line x1={exL} x2={exR} y1={cy} y2={cy} stroke={C.data} strokeWidth="1.3" />
            <line x1={exL} x2={exL} y1={cy - 4} y2={cy + 4} stroke={C.data} strokeWidth="1.3" />
            <line x1={exR} x2={exR} y1={cy - 4} y2={cy + 4} stroke={C.data} strokeWidth="1.3" />
            <line x1={cx} x2={cx} y1={eyU} y2={eyD} stroke={C.data} strokeWidth="1.3" />
            <line x1={cx - 4} x2={cx + 4} y1={eyU} y2={eyU} stroke={C.data} strokeWidth="1.3" />
            <line x1={cx - 4} x2={cx + 4} y1={eyD} y2={eyD} stroke={C.data} strokeWidth="1.3" />
            <circle cx={cx} cy={cy} r="3.4" fill="#fff" stroke={C.data} strokeWidth="1.6" />
          </g>
        );
      })}
      <g transform={`translate(${m.l + 10} ${m.t + 8})`} style={{ font: `600 11px ${SANS}` }}>
        <line x1="0" x2="20" y1="0" y2="0" stroke={C.signal} strokeWidth="2.2" />
        <text x="25" y="4" fill={C.ink}>피팅 (±1σ 밴드)</text>
        {showTrue && (
          <>
            <line x1="0" x2="20" y1="16" y2="16" stroke={C.truth} strokeWidth="1.6" strokeDasharray="5 4" />
            <text x="25" y="20" fill={C.ink}>참 곡선 (g=9.81)</text>
          </>
        )}
      </g>
    </svg>
  );
}

/* ======================= g 판독 모듈 ======================= */
function GaugeReadout({ fit, gTrue }: { fit: FitResult | null; gTrue: number }) {
  const W = 660, H = 130;
  const lo = 8.4, hi = 11.2;
  const X = (g: number) => 24 + ((g - lo) / (hi - lo)) * (W - 48);
  const g = fit?.g ?? 0;
  const sg = fit?.sg ?? 0;
  const within = fit !== null && Math.abs(g - gTrue) <= 1.96 * sg;
  const ci95 = fit ? 1.96 * sg : 0;
  return (
    <div
      style={{
        background: C.display,
        borderRadius: 14,
        padding: "16px 18px",
        color: "#cfe8e4",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div style={{ font: `600 10px ${SANS}`, letterSpacing: ".16em", color: "#5f8c87" }}>
            측정된 중력가속도
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
            <span style={{ font: `700 40px/1 ${MONO}`, color: C.displayInk, letterSpacing: "-.02em" }}>
              {fit ? g.toFixed(2) : "—.—"}
            </span>
            <span style={{ font: `600 18px ${MONO}`, color: "#9fd6cf" }}>
              ± {fit ? sg.toFixed(2) : "—"}
            </span>
            <span style={{ font: `600 14px ${SANS}`, color: "#5f8c87" }}>m/s²</span>
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            font: `500 11px ${MONO}`,
            color: "#7fb0aa",
            lineHeight: 1.7,
          }}
        >
          <div>95% 신뢰구간 ±{fit ? ci95.toFixed(2) : "—"}</div>
          <div>χ²/dof {fit ? (fit.chi2 / fit.dof).toFixed(2) : "—"}</div>
          <div style={{ color: fit ? (within ? C.displayInk : C.warn) : "#7fb0aa" }}>
            {fit ? (within ? "● 참값(9.81) 포함" : "● 참값 벗어남") : "● 데이터 부족"}
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} 46`} style={{ width: "100%", height: "auto", marginTop: 10 }}>
        <line x1="24" x2={W - 24} y1="30" y2="30" stroke="#2b3a38" strokeWidth="2" />
        {[8.5, 9, 9.5, 10, 10.5, 11].map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1="26" y2="34" stroke="#2b3a38" />
            <text x={X(v)} y="44" textAnchor="middle" style={{ font: `500 9px ${MONO}`, fill: "#4d6b67" }}>{v}</text>
          </g>
        ))}
        <line x1={X(gTrue)} x2={X(gTrue)} y1="14" y2="34" stroke={C.truth} strokeWidth="2" />
        <text x={X(gTrue)} y="11" textAnchor="middle" style={{ font: `600 9px ${MONO}`, fill: "#b79cf5" }}>9.81</text>
        {fit && (
          <>
            <rect
              x={X(g - ci95)}
              y="25"
              width={Math.max(X(g + ci95) - X(g - ci95), 2)}
              height="10"
              fill="rgba(60,240,214,0.22)"
              rx="3"
            />
            <line x1={X(g - sg)} x2={X(g + sg)} y1="30" y2="30" stroke={C.displayInk} strokeWidth="4" />
            <circle cx={X(g)} cy="30" r="4.5" fill={C.displayInk} />
          </>
        )}
      </svg>
    </div>
  );
}

/* ======================= 낙하 애니메이션 ======================= */
function DropViz({ trigger, realT, heightM }: { trigger: number; realT: number; heightM: number }) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    setY(0);
    const id = requestAnimationFrame(() => setY(1));
    return () => cancelAnimationFrame(id);
  }, [trigger]);
  const durMs = Math.min(Math.max(realT * 1000, 250), 1600);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div
        style={{
          position: "relative",
          width: 46,
          height: 120,
          background: C.paper,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 8,
            width: 16,
            height: 16,
            marginLeft: -8,
            borderRadius: "50%",
            background: C.signal,
            transform: `translateY(${y * 88}px)`,
            transition: `transform ${durMs}ms cubic-bezier(.55,0,.85,.4)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: C.border,
          }}
        />
      </div>
      <div
        style={{
          font: `500 12px ${MONO}`,
          color: C.sub,
          alignSelf: "center",
          lineHeight: 1.7,
        }}
      >
        <div>높이 {heightM ? heightM.toFixed(3) : "—"} m</div>
        <div>실제 낙하 {realT ? realT.toFixed(3) : "—"} s</div>
        <div style={{ color: C.faint, fontSize: 11 }}>(애니메이션은 시각화용)</div>
      </div>
    </div>
  );
}

/* ======================= 앱 ======================= */
let HID = 100;
const newHeight = (v: number, params: Params): HeightRecord => ({
  id: ++HID,
  trueV: v,
  measV: sampleHeight(v, params),
  times: [],
});

export default function GravityLab() {
  const gTrue = 9.81;
  const [params, setParams] = useState<Params>({
    swRes: 0.01, rulerRes: 0.001, jitter: 0.1, bias: 0.0, vt: Infinity, trials: 5,
  });
  const [object, setObject] = useState("steel");
  const [timing, setTiming] = useState("manual");
  const [model, setModel] = useState("full");
  const [view, setView] = useState("parabola");
  const [showTrue, setShowTrue] = useState(true);
  const [heights, setHeights] = useState<HeightRecord[]>(() =>
    [0.5, 1.0, 1.5, 2.0].map((v) =>
      newHeight(v, { swRes: 0.01, rulerRes: 0.001, jitter: 0.1, bias: 0, vt: Infinity, trials: 5 })
    )
  );
  const [drop, setDrop] = useState({ k: 0, t: 0, h: 0 });

  const setP = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }));

  const applyObject = (key: string) => {
    setObject(key);
    const vtMap: Record<string, number> = { steel: Infinity, wood: 22, ping: 9, foam: 5 };
    setP({ vt: vtMap[key] ?? Infinity });
  };
  const applyTiming = (key: string) => {
    setTiming(key);
    if (key === "manual") setP({ jitter: 0.1, bias: 0.0 });
    if (key === "react")  setP({ jitter: 0.08, bias: 0.18 });
    if (key === "gate")   setP({ jitter: 0.003, bias: 0.0 });
  };

  const measure = (id: number, n: number) => {
    setHeights((hs) =>
      hs.map((h) => {
        if (h.id !== id) return h;
        const real = isFinite(params.vt)
          ? fallDrag(h.trueV, gTrue, params.vt)
          : fallVac(h.trueV, gTrue);
        const add = Array.from({ length: n }, () => sampleTime(real, params));
        return { ...h, times: [...h.times, ...add] };
      })
    );
    if (n === 1) {
      const h = heights.find((x) => x.id === id);
      if (h) {
        const real = isFinite(params.vt)
          ? fallDrag(h.trueV, gTrue, params.vt)
          : fallVac(h.trueV, gTrue);
        setDrop((d) => ({ k: d.k + 1, t: real, h: h.measV }));
      }
    }
  };
  const measureAll = () => heights.forEach((h) => measure(h.id, params.trials));
  const reset = () =>
    setHeights((hs) =>
      hs.map((h) => ({ ...h, times: [], measV: sampleHeight(h.trueV, params) }))
    );
  const addH = () => setHeights((hs) => [...hs, newHeight(2.5, params)]);
  const removeH = (id: number) => setHeights((hs) => hs.filter((h) => h.id !== id));
  const setHV = (id: number, v: number) =>
    setHeights((hs) =>
      hs.map((h) =>
        h.id === id ? { ...h, trueV: v, measV: sampleHeight(v, params), times: [] } : h
      )
    );

  const { rows, fit } = useMemo(() => {
    const sh = heightSigma(params);
    const rows: DataRow[] = heights
      .filter((h) => h.times.length >= 1)
      .map((h) => {
        const N = h.times.length;
        const mean = h.times.reduce((s, x) => s + x, 0) / N;
        const sd =
          N >= 2
            ? Math.sqrt(h.times.reduce((s, x) => s + (x - mean) ** 2, 0) / (N - 1))
            : params.jitter;
        const se = N >= 2 ? sd / Math.sqrt(N) : params.jitter;
        const st = Math.sqrt(se * se + (params.swRes / Math.sqrt(12)) ** 2);
        return { id: h.id, trueV: h.trueV, t: mean, h: h.measV, st, sh, N, sd };
      });
    const fit = weightedFit(
      rows.map((r) => ({ t: r.t, h: r.h, st: r.st, sh: r.sh })),
      model
    );
    return { rows, fit };
  }, [heights, params, model]);

  const totalShots = heights.reduce((s, h) => s + h.times.length, 0);

  return (
    <div
      style={{
        minHeight: "100%",
        background: C.bg,
        color: C.ink,
        font: `400 14px/1.5 ${SANS}`,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        input[type=number]{ -moz-appearance: textfield; }
        select:focus, input:focus, button:focus-visible { outline: 2px solid ${C.signal}; outline-offset: 1px; }
        .gl-num{ width:100%; font:500 13px ${MONO}; color:${C.ink}; background:${C.paper};
          border:1px solid ${C.border}; border-radius:8px; padding:8px 10px; }
        .gl-row:hover{ background:${C.paper}; }
        @media (max-width: 920px){ .gl-grid{ grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 18px 60px" }}>
        <header style={{ marginBottom: 20 }}>
          <div
            style={{
              font: `700 10px ${SANS}`,
              letterSpacing: ".22em",
              color: C.signal,
              textTransform: "uppercase",
            }}
          >
            가상 측정 실험실 · 자유낙하
          </div>
          <h1 style={{ margin: "6px 0 4px", font: `700 26px/1.15 ${SANS}`, letterSpacing: "-.01em" }}>
            중력가속도 g 측정과 오차
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: C.sub, fontSize: 14 }}>
            여러 높이에서 낙하시간을 반복 측정해 표에 기록하고, 높이–시간 관계를 2차함수로 피팅해
            g를 구합니다. 줄자·스톱워치의 분해능, 사람의 반응시간, 공기저항이 어떻게 에러바와
            신뢰구간을 바꾸는지 실시간으로 관찰하세요.
          </p>
        </header>

        <div
          className="gl-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 348px", gap: 18, alignItems: "start" }}
        >
          {/* 좌측: 그래프 · 결과 · 표 */}
          <div style={{ display: "grid", gap: 18 }}>
            <Card
              eyebrow="실시간 그래프"
              title="높이 대 낙하시간"
              right={
                <Seg
                  value={view}
                  onChange={setView}
                  options={[
                    { v: "parabola", label: "포물선 h–t" },
                    { v: "linear", label: "직선화 h–t²" },
                  ]}
                />
              }
            >
              <Plot rows={rows} fit={fit} view={view} showTrue={showTrue} params={params} gTrue={gTrue} />
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    gap: 7,
                    alignItems: "center",
                    font: `500 13px ${SANS}`,
                    color: C.sub,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showTrue}
                    onChange={(e) => setShowTrue(e.target.checked)}
                  />
                  참 곡선 표시 (g=9.81, 진공)
                </label>
                <span style={{ font: `500 12px ${MONO}`, color: C.faint }}>
                  데이터점 {rows.length} · 총 낙하 {totalShots}회
                </span>
              </div>
            </Card>

            <GaugeReadout fit={fit} gTrue={gTrue} />

            <Card
              eyebrow="측정 기록부"
              title="데이터 테이블"
              right={<span style={{ font: `500 11px ${MONO}`, color: C.sub }}>평균±표준오차</span>}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    font: `500 12.5px ${MONO}`,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        textAlign: "right",
                        color: C.sub,
                        font: `600 11px ${SANS}`,
                      }}
                    >
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>높이 h (m)</th>
                      <th style={{ padding: "6px 8px" }}>±σ_h</th>
                      <th style={{ padding: "6px 8px" }}>N</th>
                      <th style={{ padding: "6px 8px" }}>평균 t (s)</th>
                      <th style={{ padding: "6px 8px" }}>표준편차</th>
                      <th style={{ padding: "6px 8px" }}>±σ_t</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            padding: "18px 8px",
                            color: C.faint,
                            font: `500 13px ${SANS}`,
                            textAlign: "center",
                          }}
                        >
                          오른쪽 패널에서 높이별로 낙하를 측정하면 여기에 기록됩니다.
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="gl-row"
                        style={{ textAlign: "right", borderTop: `1px solid ${C.border}` }}
                      >
                        <td style={{ textAlign: "left", padding: "7px 8px" }}>{r.h.toFixed(3)}</td>
                        <td style={{ padding: "7px 8px", color: C.sub }}>{r.sh.toFixed(4)}</td>
                        <td style={{ padding: "7px 8px" }}>{r.N}</td>
                        <td style={{ padding: "7px 8px", color: C.signal }}>{r.t.toFixed(3)}</td>
                        <td style={{ padding: "7px 8px", color: C.sub }}>
                          {r.N >= 2 ? r.sd.toFixed(3) : "—"}
                        </td>
                        <td style={{ padding: "7px 8px", color: C.sub }}>{r.st.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card eyebrow="왜 이런 한계가 생길까" title="오차 원인 노트">
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: C.sub,
                  fontSize: 13.5,
                  lineHeight: 1.7,
                }}
              >
                <li>
                  <b style={{ color: C.ink }}>줄자(y축):</b> 위·아래 두 지점을 각각 ±½눈금으로
                  읽어 높이차의 불확도는 σ_h = √2 ×(눈금/2) ={" "}
                  <b style={{ color: C.ink }}>{(heightSigma(params) * 1000).toFixed(2)} mm</b>.
                  반복해도 줄지 않는 계통적 한계.
                </li>
                <li>
                  <b style={{ color: C.ink }}>스톱워치(x축):</b> 평균의 표준오차는 √N에 반비례해
                  반복으로 줄지만, 분해능 {params.swRes}s 의 양자화 바닥(σ≈
                  {(params.swRes / Math.sqrt(12)).toFixed(4)}s)은 남습니다.
                </li>
                <li>
                  <b style={{ color: C.ink }}>반응시간:</b> 일정한 오프셋은{" "}
                  <b style={{ color: C.ink }}>h=a·t²+b·t+c</b> 모델이 흡수하지만,{" "}
                  <b style={{ color: C.ink }}>h=a·t²</b>로 피팅하면 g가 편향됩니다(모델·메소드의
                  한계). 모델을 바꿔 비교해 보세요.
                </li>
                <li>
                  <b style={{ color: C.ink }}>공기저항:</b> 데이터가 포물선에서 체계적으로 휘어,
                  반복 측정으로는 제거되지 않는{" "}
                  <b style={{ color: C.ink }}>계통오차</b>가 됩니다. 직선화(h–t²) 보기에서
                  곡률로 드러납니다.
                </li>
                <li>
                  <b style={{ color: C.ink }}>χ²/dof:</b> 1 부근이면 에러바가 산포를 잘 설명.
                  ≫1이면 미설명 오차(공기저항 등), ≪1이면 에러바 과대평가를 의미합니다.
                </li>
              </ul>
            </Card>
          </div>

          {/* 우측: 컨트롤 */}
          <div style={{ display: "grid", gap: 18, position: "sticky", top: 16 }}>
            <Card eyebrow="실험 조건" title="측정 장비 · 환경">
              <Field
                label="낙하 물체"
                hint={isFinite(params.vt) ? `vt ${params.vt} m/s` : "진공 가정"}
              >
                <Seg
                  value={object}
                  onChange={applyObject}
                  options={[
                    { v: "steel", label: "쇠구슬" },
                    { v: "wood", label: "나무" },
                    { v: "ping", label: "탁구공" },
                    { v: "foam", label: "스티로폼" },
                  ]}
                />
              </Field>
              <Field
                label="타이밍 방식"
                hint={timing === "react" ? `오프셋 ${params.bias}s` : `산포 ${params.jitter}s`}
              >
                <Seg
                  value={timing}
                  onChange={applyTiming}
                  options={[
                    { v: "manual", label: "수동" },
                    { v: "react", label: "반응↑" },
                    { v: "gate", label: "광게이트" },
                  ]}
                />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="스톱워치 분해능">
                  <select
                    className="gl-num"
                    style={selStyle}
                    value={params.swRes}
                    onChange={(e) => setP({ swRes: +e.target.value })}
                  >
                    <option value={0.001}>0.001 s</option>
                    <option value={0.01}>0.01 s</option>
                    <option value={0.1}>0.1 s</option>
                    <option value={1}>1 s</option>
                  </select>
                </Field>
                <Field label="줄자 분해능">
                  <select
                    style={selStyle}
                    value={params.rulerRes}
                    onChange={(e) => setP({ rulerRes: +e.target.value })}
                  >
                    <option value={0.0001}>0.1 mm</option>
                    <option value={0.001}>1 mm</option>
                    <option value={0.01}>1 cm</option>
                  </select>
                </Field>
              </div>
              <Field label={`타이밍 산포 σ_jitter = ${params.jitter.toFixed(3)} s`}>
                <input
                  type="range"
                  min="0"
                  max="0.3"
                  step="0.005"
                  value={params.jitter}
                  onChange={(e) => setP({ jitter: +e.target.value })}
                  style={{ width: "100%", accentColor: C.signal }}
                />
              </Field>
              <Field label={`반응시간 오프셋 b = ${params.bias.toFixed(3)} s`}>
                <input
                  type="range"
                  min="0"
                  max="0.4"
                  step="0.01"
                  value={params.bias}
                  onChange={(e) => setP({ bias: +e.target.value })}
                  style={{ width: "100%", accentColor: C.signal }}
                />
              </Field>
              <Field label={`반복 횟수 / 높이 = ${params.trials}회`}>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={params.trials}
                  onChange={(e) => setP({ trials: +e.target.value })}
                  style={{ width: "100%", accentColor: C.signal }}
                />
              </Field>
            </Card>

            <Card eyebrow="피팅 메소드" title="모델 선택">
              <Seg
                value={model}
                onChange={setModel}
                options={[
                  { v: "full", label: "a t²+b t+c" },
                  { v: "noLinear", label: "a t²+c" },
                  { v: "pure", label: "a t²" },
                ]}
              />
              <p style={{ margin: "10px 0 0", font: `500 12.5px ${SANS}`, color: C.sub }}>
                <b style={{ color: C.ink }}>{BASIS[model].label}</b> — {BASIS[model].note}.
                자유파라미터가 늘면 편향은 줄지만 g의 불확도는 커집니다.
              </p>
            </Card>

            <Card
              eyebrow="높이 구성"
              title="측정 지점"
              right={<Btn kind="ghost" onClick={addH}>+ 높이</Btn>}
            >
              <div style={{ display: "grid", gap: 8 }}>
                {heights.map((h) => (
                  <div key={h.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={h.trueV}
                      onChange={(e) =>
                        setHV(h.id, Math.max(0.05, +e.target.value || 0))
                      }
                      style={{ ...selStyle, width: 78, fontFamily: MONO }}
                    />
                    <span style={{ font: `500 12px ${MONO}`, color: C.faint, width: 26 }}>m</span>
                    <span
                      style={{
                        font: `600 12px ${MONO}`,
                        color: h.times.length ? C.signal : C.faint,
                        flex: 1,
                      }}
                    >
                      {h.times.length}회
                    </span>
                    <Btn kind="ghost" onClick={() => measure(h.id, 1)}>1회</Btn>
                    <Btn kind="primary" onClick={() => measure(h.id, params.trials)}>
                      +{params.trials}
                    </Btn>
                    {heights.length > 2 && (
                      <button
                        onClick={() => removeH(h.id)}
                        title="삭제"
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: C.faint,
                          font: `600 16px ${SANS}`,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <DropViz trigger={drop.k} realT={drop.t} heightM={drop.h} />
              </div>
            </Card>

            <Card eyebrow="실행" title="일괄 측정">
              <div style={{ display: "grid", gap: 8 }}>
                <Btn kind="solid" full onClick={measureAll}>
                  모든 높이 × {params.trials}회 측정
                </Btn>
                <Btn kind="ghost" full onClick={reset}>
                  측정값 초기화
                </Btn>
              </div>
            </Card>
          </div>
        </div>

        <footer
          style={{
            marginTop: 28,
            paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
            font: `500 12px ${SANS}`,
            color: C.faint,
          }}
        >
          가중 최소제곱 + 유효분산(양축 오차) 피팅 · g = 2a, 불확도는 계수 a의 공분산에서 전파 ·
          참값 g = 9.81 m/s².
        </footer>
      </div>
    </div>
  );
}
