'use client';

import { useState, useRef, useEffect } from 'react';

/* ===================== Types ===================== */
type Theme = 'light' | 'dark';
type PKey = 'e-' | 'mu-' | 'pi+' | 'pi-' | 'K+' | 'p';
type CK = 'lep' | 'mu' | 'pi' | 'kao' | 'pro';

interface Pt { x: number; y: number }
interface Layout {
  W: number; H: number; cy: number; x0: number;
  trackerX: number[]; tofX: number; tofW: number;
  emF: number; emB: number; hcF: number; hcB: number;
  vTop: number; vBot: number; trkTop: number; trkBot: number;
  ppm: number;
}
interface IntegResult {
  pts: Pt[]; hits: Pt[];
  reach: { tracker: boolean; tof: boolean; emcal: boolean; hcal: boolean };
}
interface PartInfo { label: string; sub: string; mass: number; charge: number; cls: 'em'|'mu'|'had'; ck: CK; }
interface TrajData extends IntegResult {
  part: PartInfo; Rm: number; Rpx: number; beta: number;
  E: number; pT: number; q: number; sign: number;
  tofNs: number; eEm: number; eHc: number; fr: { em: number; had: number };
}
interface Scene7 { curl: IntegResult; decay: Pt[] }
interface Scene9 { parent: Pt[]; vx: number; vy: number; d1: IntegResult; d2: IntegResult }
interface Colors {
  lep: string; mu: string; pi: string; kao: string; pro: string; neut: string;
  cyan: string; ink: string; inkSoft: string; field: string; hit: string;
  emFill: string; emStroke: string; hcFill: string; hcStroke: string;
  tofFill: string; tofStroke: string;
}

/* ===================== Constants ===================== */
const PARTS: Record<PKey, PartInfo> = {
  'e-':  { label: 'e⁻', sub: '전자',   mass: 0.000511, charge: -1, cls: 'em',  ck: 'lep' },
  'mu-': { label: 'μ⁻', sub: '뮤온',   mass: 0.10566,  charge: -1, cls: 'mu',  ck: 'mu'  },
  'pi+': { label: 'π⁺', sub: '파이온', mass: 0.13957,  charge:  1, cls: 'had', ck: 'pi'  },
  'pi-': { label: 'π⁻', sub: '파이온', mass: 0.13957,  charge: -1, cls: 'had', ck: 'pi'  },
  'K+':  { label: 'K⁺', sub: '케이온', mass: 0.49368,  charge:  1, cls: 'had', ck: 'kao' },
  'p':   { label: 'p',  sub: '양성자', mass: 0.93827,  charge:  1, cls: 'had', ck: 'pro' },
};
const ORDER: PKey[] = ['e-', 'mu-', 'pi+', 'pi-', 'K+', 'p'];
const ENERGY: Record<string, { em: number; had: number }> = {
  em: { em: 0.92, had: 0.05 }, mu: { em: 0.03, had: 0.04 }, had: { em: 0.22, had: 0.60 },
};
const ACTIVE_KEY: Record<number, string> = { 1:'ip', 2:'tracker', 3:'field', 4:'tracker', 5:'tof', 6:'calo', 8:'tracker' };
const STEPS = [
  { tag:'INJECTION',      title:'한 점에서, 한 방향으로',
    body:'입자는 충돌·표적 지점(IP)이라는 한 점에서 일정한 방향으로 날아옵니다. 이 출발점과 기준 시각 t₀가 이후 모든 측정의 원점이 됩니다.',
    formula:'p⃗ = (pₓ, p_y) · 출발점 (x₀, y₀), 기준 시각 t₀', formNote:'모든 위치·시간은 이 원점을 기준으로 잽니다.' },
  { tag:'TRACKER',        title:'얇은 평면들이 줄지어 선다',
    body:'진행 경로에는 여러 장의 얇은 추적 평면(tracker plane)이 세워져 있습니다. 입자가 지나갈 때마다 그 평면 위 위치를 한 점씩 기록합니다.',
    formula:'각 평면 i 에서 통과 위치 (xᵢ, yᵢ) 를 기록', formNote:'평면이 많을수록 궤적을 더 촘촘히 그릴 수 있습니다.' },
  { tag:'MAGNETIC FIELD', title:'전 공간에 자기장이 걸린다',
    body:'검출기 전체에 자기장 B가 지면 안쪽(⊗)으로 걸려 있습니다. 전하를 띤 입자는 로런츠 힘을 받아 휘어지고, 전하의 부호에 따라 휘는 방향이 반대가 됩니다.',
    formula:'F⃗ = q·v⃗ × B⃗  →  원운동, 반경 R = p_T /(q·B)', formNote:'B를 키우거나 운동량을 줄이면 더 많이 휩니다. 슬라이더로 확인해 보세요.' },
  { tag:'HITS',           title:'궤적은 점들로 남는다',
    body:'휘어진 입자는 tracker 평면마다 hit(점)을 남깁니다. 이 점들을 이으면 자기장 속에서 그린 곡선 궤적이 드러납니다.',
    formula:'궤적 ≈ 점들의 집합 { (x₁,y₁), (x₂,y₂), … }', formNote:'검출기는 연속 선이 아니라 이 점들만 봅니다.' },
  { tag:'TIME OF FLIGHT', title:'언제 도착했나 — TOF',
    body:'tracker 뒤의 TOF는 기준 시각으로부터의 도달 시간차 Δt를 잽니다. 운동량이 같아도 무거운(느린) 입자는 더 늦게 도착하므로, 시간만으로 질량을 가늠할 수 있습니다.',
    formula:'t = L /(β·c),   β = p /√(p² + m²)', formNote:'같은 p에서 무거울수록 β가 작아 → 늦게 도착. 입자를 바꿔 보세요.' },
  { tag:'CALORIMETER',    title:'얼마나 가졌나 — EMCAL · HCAL',
    body:'맨 뒤 칼로리미터까지 도달하면 입자는 에너지를 모두 쏟아내고, 그 양을 측정합니다. EMCAL은 전자·광자의 전자기 에너지를, HCAL은 강입자 에너지를 흡수합니다.',
    formula:'E = √(p² + m²)  → 막대 = 흡수된 에너지', formNote:'전자는 EMCAL, 강입자는 주로 HCAL. 뮤온은 거의 다 통과합니다.' },
  { tag:'LIMITS',         title:'끝까지 못 가는 입자들',
    body:'붕괴가 매우 빠르면 입자는 검출기 앞에서 사라져 tracker조차 닿지 못합니다. 또 자기장이 세거나 운동량이 작아 회전반경이 너무 작으면, 안쪽에서 돌돌 말려 칼로리미터까지 가지 못합니다.',
    formula:'R ∝ p_T / B  →  B↑ 또는 p_T↓ 면 R↓', formNote:'B를 3 T로, 운동량을 0.4 GeV로 낮춰 보면 직접 보입니다.' },
  { tag:'CIRCLE FIT',     title:'원으로 피팅해 p_T를 얻는다',
    body:'tracker가 남긴 점들을 원의 방정식으로 피팅하면 곡률 반경 R이 나옵니다. 자기장 B를 알고 있으니, 여기서 입자의 횡운동량 p_T를 곧바로 계산할 수 있습니다.',
    formula:'(x−a)² + (y−b)² = R²  →  p_T [GeV] ≈ 0.3 · B [T] · R [m]', formNote:'덜 휜(반경 큰) 트랙일수록 운동량이 큰 입자입니다.' },
  { tag:'VERTEX',         title:'붙어 있는 트랙 = 한 입자의 붕괴',
    body:'한 점에서 아주 가까이 붙어 갈라지는 트랙들은, 그 자리에서 하나의 모입자가 붕괴해 생긴 것으로 봅니다. 공통 꼭짓점(vertex)을 찾아 딸입자들을 합치면 보이지 않던 모입자를 재구성할 수 있습니다.',
    formula:'공통 vertex →  p⃗_parent = Σ p⃗_daughter', formNote:'중성 모입자는 트랙을 안 남기지만, 딸들의 V자 패턴으로 알아냅니다.' },
];

/* ===================== Color palettes ===================== */
function mkColors(theme: Theme): Colors {
  return theme === 'dark'
    ? { lep:'#8FE7F2', mu:'#A9B6F5', pi:'#2DE2FF', kao:'#D49A6B', pro:'#F0B33A', neut:'rgba(150,170,200,.6)',
        cyan:'#2DE2FF', ink:'#E9F2F9', inkSoft:'#8D9BB1', field:'rgba(120,175,215,.20)', hit:'#2DE2FF',
        emFill:'rgba(45,226,255,.10)', emStroke:'rgba(45,226,255,.5)',
        hcFill:'rgba(212,154,107,.12)', hcStroke:'rgba(212,154,107,.55)',
        tofFill:'rgba(231,179,62,.12)', tofStroke:'rgba(231,179,62,.55)' }
    : { lep:'#3EB6C9', mu:'#6E7BD0', pi:'#16B6D2', kao:'#B0744A', pro:'#D4862A', neut:'rgba(70,80,100,.55)',
        cyan:'#16B6D2', ink:'#1B2230', inkSoft:'#646C7E', field:'rgba(28,34,48,.18)', hit:'#16B6D2',
        emFill:'rgba(22,182,210,.10)', emStroke:'rgba(22,182,210,.55)',
        hcFill:'rgba(175,114,74,.10)', hcStroke:'rgba(175,114,74,.6)',
        tofFill:'rgba(212,154,38,.12)', tofStroke:'rgba(212,154,38,.6)' };
}

function mkVars(isDark: boolean) {
  return isDark
    ? { '--paper':'#080E18','--paper-2':'#0C1420','--card':'#0F1A2A','--card-2':'#0C1626',
        '--grid':'rgba(120,175,215,.055)','--grid-strong':'rgba(120,175,215,.11)',
        '--ink':'#E9F2F9','--ink-soft':'#8D9BB1','--border':'rgba(130,175,215,.16)',
        '--tile':'#0A1422','--tile-ink':'#BCEFFF','--cyan':'#2DE2FF',
        '--accent-text':'#62ECFF','--glow':'rgba(45,226,255,.32)',
        '--copper':'#D49A6B','--mustard':'#E7B33E',
        '--shadow':'0 1px 2px rgba(0,0,0,.45), 0 14px 38px rgba(0,0,0,.5)' }
    : { '--paper':'#FAF8F3','--paper-2':'#F2EDE3','--card':'#FFFFFF','--card-2':'#FBF8F2',
        '--grid':'rgba(28,34,48,.055)','--grid-strong':'rgba(28,34,48,.11)',
        '--ink':'#1B2230','--ink-soft':'#646C7E','--border':'rgba(28,34,48,.12)',
        '--tile':'#101826','--tile-ink':'#EAF6FA','--cyan':'#16B6D2',
        '--accent-text':'#0C8499','--glow':'rgba(34,211,238,.20)',
        '--copper':'#AF724A','--mustard':'#D49A26',
        '--shadow':'0 1px 2px rgba(28,34,48,.05), 0 10px 26px rgba(28,34,48,.055)' };
}

/* ===================== Physics helpers ===================== */
function compLayout(W: number, H: number): Layout {
  return {
    W, H, cy: H*0.5, x0: W*0.075,
    trackerX: [0.17,0.215,0.26,0.305,0.35,0.395].map(f=>W*f),
    tofX: W*0.50, tofW: W*0.016,
    emF: W*0.565, emB: W*0.685, hcF: W*0.705, hcB: W*0.875,
    vTop: H*0.19, vBot: H*0.81, trkTop: H*0.15, trkBot: H*0.85,
    ppm: (W*0.875)/4.0,
  };
}

function integrate(L: Layout, x0: number, y0: number, theta0: number, Rpx: number, sign: number): IntegResult {
  const ds = 4;
  let x=x0, y=y0, th=theta0;
  const pts: Pt[]=[{x,y}], hits: Pt[]=[];
  const reach = { tracker:false, tof:false, emcal:false, hcal:false };
  const kappa = (!isFinite(Rpx)||Rpx>1e6) ? 0 : sign/Rpx;
  let maxSteps = 2600;
  if (isFinite(Rpx)&&Rpx>0&&(x0+Rpx)<L.tofX) maxSteps=Math.min(maxSteps,Math.ceil(1.35*2*Math.PI*Rpx/ds));
  for (let s=0; s<maxSteps; s++) {
    const px=x, py=y;
    th+=kappa*ds; x+=Math.cos(th)*ds; y+=Math.sin(th)*ds; pts.push({x,y});
    for (let i=0; i<L.trackerX.length; i++) {
      const plane=L.trackerX[i];
      if ((px-plane)*(x-plane)<=0&&Math.abs(x-px)>1e-4) {
        const t=(plane-px)/(x-px), hy=py+(y-py)*t;
        if (hy>L.trkTop&&hy<L.trkBot) { hits.push({x:plane,y:hy}); reach.tracker=true; }
      }
    }
    if (x>=L.tofX-L.tofW&&x<=L.tofX+L.tofW&&y>L.vTop&&y<L.vBot) reach.tof=true;
    if (x>=L.emF&&x<=L.emB&&y>L.vTop&&y<L.vBot) reach.emcal=true;
    if (x>=L.hcF&&x<=L.hcB&&y>L.vTop&&y<L.vBot) reach.hcal=true;
    if (x>L.W*0.94||x<L.W*0.02||y<L.H*0.03||y>L.H*0.97) break;
  }
  return { pts, hits, reach };
}

function mkLine(x1:number, y1:number, x2:number, y2:number, n=40): Pt[] {
  const a: Pt[]=[];
  for (let i=0;i<=n;i++) { const t=i/n; a.push({x:x1+(x2-x1)*t,y:y1+(y2-y1)*t}); }
  return a;
}

const sfn = (x:number) => x*x*(3-2*x);

function rrect(ctx:CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

/* ===================== Canvas drawing ===================== */
function drawField(ctx:CanvasRenderingContext2D, L:Layout, C:Colors, active:string) {
  const on=active==='field';
  ctx.save(); ctx.strokeStyle=C.field; ctx.globalAlpha=on?1:0.5; ctx.lineWidth=1;
  const sx=(L.hcB-L.x0)/9, sy=(L.vBot-L.vTop)/5;
  for (let x=L.x0+sx*0.5;x<L.hcB;x+=sx)
    for (let y=L.vTop+sy*0.4;y<L.vBot;y+=sy) {
      ctx.beginPath(); ctx.arc(x,y,4,0,7);
      ctx.moveTo(x-2.8,y-2.8); ctx.lineTo(x+2.8,y+2.8);
      ctx.moveTo(x+2.8,y-2.8); ctx.lineTo(x-2.8,y+2.8); ctx.stroke();
    }
  if (on) { ctx.globalAlpha=1; ctx.fillStyle=C.inkSoft; ctx.font='600 11px "IBM Plex Mono",monospace'; ctx.fillText('B  ⊗  지면 안쪽',L.x0,L.vTop-12); }
  ctx.restore();
}

function drawDetector(ctx:CanvasRenderingContext2D, L:Layout, C:Colors, active:string) {
  ctx.save(); ctx.font='600 11px "IBM Plex Mono",monospace'; ctx.textBaseline='alphabetic';
  const cy=L.cy, ipOn=active==='ip';
  ctx.strokeStyle=C.cyan; ctx.globalAlpha=ipOn?0.8:0.45; ctx.lineWidth=1.6; ctx.setLineDash([2,5]);
  ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(L.x0,cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha=1; ctx.fillStyle=C.cyan; ctx.shadowBlur=ipOn?14:6; ctx.shadowColor=C.cyan;
  ctx.beginPath(); ctx.arc(L.x0,cy,ipOn?5.5:4,0,7); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle=C.inkSoft; ctx.fillText('IP · 충돌점',L.x0-8,cy+22);
  const tOn=active==='tracker';
  L.trackerX.forEach(x=>{ ctx.strokeStyle=C.inkSoft; ctx.globalAlpha=0.3+(tOn?0.5:0.18); ctx.lineWidth=tOn?2:1.4; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.moveTo(x,L.trkTop); ctx.lineTo(x,L.trkBot); ctx.stroke(); });
  ctx.setLineDash([]); ctx.globalAlpha=1; ctx.fillStyle=tOn?C.cyan:C.inkSoft; ctx.fillText('TRACKER',L.trackerX[0]-2,L.trkTop-12);
  const fOn=active==='tof';
  ctx.globalAlpha=0.5+(fOn?0.5:0.18); ctx.fillStyle=C.tofFill; ctx.strokeStyle=C.tofStroke; ctx.lineWidth=1.5;
  rrect(ctx,L.tofX-L.tofW/2,L.vTop,L.tofW,L.vBot-L.vTop,4); ctx.fill(); ctx.stroke();
  ctx.globalAlpha=1; ctx.fillStyle=fOn?C.tofStroke:C.inkSoft; ctx.fillText('TOF',L.tofX-12,L.vTop-12);
  const cOn=active==='calo';
  ctx.globalAlpha=0.5+(cOn?0.5:0.2);
  ctx.fillStyle=C.emFill; ctx.strokeStyle=C.emStroke; ctx.lineWidth=1.5;
  rrect(ctx,L.emF,L.vTop,L.emB-L.emF,L.vBot-L.vTop,6); ctx.fill(); ctx.stroke();
  ctx.fillStyle=C.hcFill; ctx.strokeStyle=C.hcStroke;
  rrect(ctx,L.hcF,L.vTop,L.hcB-L.hcF,L.vBot-L.vTop,6); ctx.fill(); ctx.stroke();
  ctx.globalAlpha=1;
  ctx.fillStyle=cOn?C.emStroke:C.inkSoft; ctx.fillText('EMCAL',L.emF+6,L.vTop-12);
  ctx.fillStyle=cOn?C.hcStroke:C.inkSoft; ctx.fillText('HCAL',L.hcF+6,L.vTop-12);
  ctx.restore();
}

function drawGrow(ctx:CanvasRenderingContext2D, pts:Pt[], frac:number, color:string, width:number, dashed:boolean, glow:boolean): Pt {
  const n=pts.length, last=Math.max(1,Math.floor(sfn(Math.min(1,frac))*(n-1)));
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.lineJoin='round';
  if (glow){ctx.shadowBlur=8;ctx.shadowColor=color;} if(dashed) ctx.setLineDash([5,5]);
  ctx.beginPath(); for(let i=0;i<=last;i++){const p=pts[i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);} ctx.stroke(); ctx.setLineDash([]);
  const h=pts[Math.min(last,n-1)];
  if (!dashed){ctx.shadowBlur=glow?11:0;ctx.fillStyle=color;ctx.beginPath();ctx.arc(h.x,h.y,width*1.25,0,7);ctx.fill();}
  ctx.restore(); return h;
}

function drawHits(ctx:CanvasRenderingContext2D, hits:Pt[], headX:number, C:Colors, big:boolean) {
  ctx.save();
  hits.forEach(ht=>{
    if(ht.x<=headX+1){
      ctx.fillStyle=C.hit;ctx.shadowBlur=6;ctx.shadowColor=C.hit;ctx.beginPath();ctx.arc(ht.x,ht.y,big?3.6:2.8,0,7);ctx.fill();
      if(big){ctx.shadowBlur=0;ctx.strokeStyle=C.hit;ctx.globalAlpha=0.5;ctx.lineWidth=1;ctx.beginPath();ctx.arc(ht.x,ht.y,6,0,7);ctx.stroke();ctx.globalAlpha=1;}
    }
  });
  ctx.restore();
}

function drawCircleFit(ctx:CanvasRenderingContext2D, t:TrajData, L:Layout, C:Colors) {
  if(!t.hits.length) return;
  const cx=L.x0, cyc=L.cy+t.sign*t.Rpx;
  ctx.save(); ctx.strokeStyle=C.cyan; ctx.globalAlpha=0.5; ctx.setLineDash([4,6]); ctx.lineWidth=1.3;
  ctx.beginPath(); ctx.arc(cx,cyc,t.Rpx,0,7); ctx.stroke(); ctx.setLineDash([]);
  const hit=t.hits[Math.floor(t.hits.length/2)];
  ctx.globalAlpha=0.85; ctx.beginPath(); ctx.moveTo(cx,cyc); ctx.lineTo(hit.x,hit.y); ctx.stroke();
  ctx.fillStyle=C.cyan; ctx.beginPath(); ctx.arc(cx,cyc,3,0,7); ctx.fill();
  ctx.font='600 11px "IBM Plex Mono",monospace';
  ctx.fillText('R = '+t.Rm.toFixed(2)+' m',(cx+hit.x)/2+6,(cyc+hit.y)/2);
  ctx.restore();
}

function drawScene7(ctx:CanvasRenderingContext2D, L:Layout, C:Colors, frac:number, s:Scene7|null) {
  if(!s) return;
  drawGrow(ctx,s.curl.pts,frac,C.pi,2,false,true);
  ctx.save(); ctx.font='600 11px "IBM Plex Mono",monospace'; ctx.fillStyle=C.inkSoft;
  ctx.fillText('회전반경이 작아 tracker 도달 실패',L.x0,L.vBot+26); ctx.restore();
  drawGrow(ctx,s.decay,frac,C.neut,1.6,true,false);
  const v=s.decay[s.decay.length-1];
  if(frac>0.55){const k=Math.min(1,(frac-0.55)/0.3);ctx.save();ctx.globalAlpha=1-k;ctx.strokeStyle=C.cyan;ctx.lineWidth=2;ctx.shadowBlur=12;ctx.shadowColor=C.cyan;ctx.beginPath();ctx.arc(v.x,v.y,4+k*16,0,7);ctx.stroke();ctx.restore();}
  ctx.save(); ctx.font='600 11px "IBM Plex Mono",monospace'; ctx.fillStyle=C.inkSoft; ctx.fillText('붕괴가 빨라 검출 전 소멸',v.x-30,v.y-14); ctx.restore();
}

function drawScene9(ctx:CanvasRenderingContext2D, L:Layout, C:Colors, frac:number, s:Scene9|null) {
  if(!s) return;
  const pf=Math.min(1,frac/0.38), df=Math.max(0,(frac-0.32)/0.68);
  drawGrow(ctx,s.parent,pf,C.neut,1.8,true,false);
  if(frac>=0.3){
    const h1=drawGrow(ctx,s.d1.pts,df,C.pro,2,false,true);
    const h2=drawGrow(ctx,s.d2.pts,df,C.pi,2,false,true);
    drawHits(ctx,s.d1.hits,h1.x,C,false); drawHits(ctx,s.d2.hits,h2.x,C,false);
    ctx.save();ctx.fillStyle=C.cyan;ctx.shadowBlur=10;ctx.shadowColor=C.cyan;ctx.beginPath();ctx.arc(s.vx,s.vy,4,0,7);ctx.fill();ctx.restore();
    ctx.save();ctx.strokeStyle=C.cyan;ctx.globalAlpha=0.7;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(s.vx,s.vy,16,-0.9,0.9);ctx.stroke();ctx.restore();
  }
  ctx.save(); ctx.font='600 11px "IBM Plex Mono",monospace'; ctx.fillStyle=C.inkSoft;
  ctx.fillText('공통 꼭짓점(vertex) → 한 입자에서 붕괴',s.vx+20,s.vy-16);
  ctx.fillText('p, π⁻ 두 딸입자',s.vx+20,s.vy+28); ctx.restore();
}

/* ===================== Component ===================== */
export default function DetectorPage() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [B, setB] = useState(1.5);
  const [momentum, setMomentum] = useState(2.0);
  const [pkey, setPkey] = useState<PKey>('pi+');
  const [activeStep, setActiveStep] = useState(1);
  const [open, setOpen] = useState<Record<number,boolean>>({});
  const [hud, setHud] = useState({ R:'—', pT:'—', beta:'—', tof:'—', emE:'—', hcE:'—' });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const emcalFillRef = useRef<HTMLSpanElement>(null);
  const hcalFillRef = useRef<HTMLSpanElement>(null);
  // refs for animation loop
  const themeRef = useRef<Theme>('dark');
  const activeStepRef = useRef(1);
  const BRef = useRef(1.5);
  const momRef = useRef(2.0);
  const pkeyRef = useRef<PKey>('pi+');
  const cwRef = useRef(0);
  const chRef = useRef(0);
  const layoutRef = useRef<Layout|null>(null);
  const trajRef = useRef<TrajData|null>(null);
  const scene7Ref = useRef<Scene7|null>(null);
  const scene9Ref = useRef<Scene9|null>(null);
  const rafRef = useRef(0);
  const t0Ref = useRef(0);

  const recompute = () => {
    if(!cwRef.current) return;
    const L=compLayout(cwRef.current,chRef.current); layoutRef.current=L;
    const part=PARTS[pkeyRef.current], pT=momRef.current, m=part.mass;
    const E=Math.sqrt(pT*pT+m*m), beta=pT/E;
    const Rm=pT/(0.2998*Math.max(BRef.current,0.001)), Rpx=Rm*L.ppm;
    const sign=part.charge>=0?1:-1, r=integrate(L,L.x0,L.cy,0,Rpx,sign);
    const fr=ENERGY[part.cls], Ltof=(L.tofX-L.x0)/L.ppm, tofNs=Ltof/(beta*0.2998);
    const eEm=r.reach.emcal?E*fr.em:0, eHc=r.reach.hcal?E*fr.had:0;
    trajRef.current={...r,part,Rm,Rpx,beta,E,pT,q:part.charge,sign,tofNs,eEm,eHc,fr};
    const curlR=(L.tofX-L.x0)*0.40;
    scene7Ref.current={curl:integrate(L,L.x0,L.cy,0,curlR,1),decay:mkLine(L.x0,L.cy,L.x0+(L.trackerX[0]-L.x0)*0.62,L.cy-L.H*0.11,30)};
    const vx=L.trackerX[1], vy=L.cy;
    scene9Ref.current={parent:mkLine(L.x0,L.cy,vx,vy,26),vx,vy,d1:integrate(L,vx,vy,-0.11,(L.tofX-vx)*2.3,1),d2:integrate(L,vx,vy,0.12,(L.tofX-vx)*1.7,-1)};
    setHud({R:Rm.toFixed(2)+' m',pT:pT.toFixed(1)+' GeV',beta:beta.toFixed(3),tof:r.reach.tof?tofNs.toFixed(2)+' ns':'도달 안함',emE:r.reach.emcal?eEm.toFixed(2):'—',hcE:r.reach.hcal?eHc.toFixed(2):'—'});
  };

  const sizeCanvas = () => {
    const c=canvasRef.current, w=wrapRef.current; if(!c||!w) return;
    const rect=w.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
    c.width=Math.round(rect.width*dpr); c.height=Math.round(rect.height*dpr);
    const ctx=c.getContext('2d'); if(ctx) ctx.setTransform(dpr,0,0,dpr,0,0);
    cwRef.current=rect.width; chRef.current=rect.height;
  };

  const syncBars = (L:Layout, frac:number, step:number) => {
    const t=trajRef.current, ef=emcalFillRef.current, hf=hcalFillRef.current; if(!t||!ef||!hf) return;
    let headX=-1;
    if(step!==7&&step!==9){const n=t.pts.length,last=Math.max(1,Math.floor(sfn(Math.min(1,frac))*(n-1)));headX=t.pts[last].x;}
    const emP=headX<0?0:Math.max(0,Math.min(1,(headX-L.emF)/(L.emB-L.emF)));
    const hcP=headX<0?0:Math.max(0,Math.min(1,(headX-L.hcF)/(L.hcB-L.hcF)));
    ef.style.width=(t.reach.emcal?t.fr.em*emP*100:0).toFixed(1)+'%';
    hf.style.width=(t.reach.hcal?t.fr.had*hcP*100:0).toFixed(1)+'%';
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{
    sizeCanvas(); recompute(); t0Ref.current=performance.now();
    const ro=new ResizeObserver(()=>{sizeCanvas();recompute();});
    if(wrapRef.current) ro.observe(wrapRef.current);
    const io=new IntersectionObserver(es=>{
      es.forEach(e=>{if(e.isIntersecting){const i=Number(e.target.getAttribute('data-step'));if(i){setActiveStep(i);activeStepRef.current=i;}}});
    },{rootMargin:'-45% 0px -45% 0px',threshold:0});
    stepsRef.current?.querySelectorAll('[data-step]').forEach(el=>io.observe(el));
    const loop=(now:number)=>{
      const c=canvasRef.current, L=layoutRef.current;
      if(c&&L&&cwRef.current){
        const ctx=c.getContext('2d');
        if(ctx){
          const C=mkColors(themeRef.current), active=ACTIVE_KEY[activeStepRef.current]??'';
          ctx.clearRect(0,0,cwRef.current,chRef.current);
          drawField(ctx,L,C,active); drawDetector(ctx,L,C,active);
          const frac=Math.min(1,((now-t0Ref.current)/1000%3.8)/2.3);
          const step=activeStepRef.current;
          if(step===7) drawScene7(ctx,L,C,frac,scene7Ref.current);
          else if(step===9) drawScene9(ctx,L,C,frac,scene9Ref.current);
          else{
            const t=trajRef.current;
            if(t){
              const n=t.pts.length,last=Math.max(1,Math.floor(sfn(Math.min(1,frac))*(n-1)));
              const headX=t.pts[last].x;
              drawGrow(ctx,t.pts,frac,C[t.part.ck],2.3,false,true);
              drawHits(ctx,t.hits,headX,C,active==='tracker');
              if(step===8) drawCircleFit(ctx,t,L,C);
            }
          }
          syncBars(L,frac,step);
        }
      }
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(rafRef.current);ro.disconnect();io.disconnect();};
  },[]);

  const isDark = theme==='dark';
  themeRef.current = theme;

  const handleB=(e:React.ChangeEvent<HTMLInputElement>)=>{const v=Number(e.target.value);BRef.current=v;setB(v);recompute();};
  const handleP=(e:React.ChangeEvent<HTMLInputElement>)=>{const v=Number(e.target.value);momRef.current=v;setMomentum(v);recompute();};
  const handlePart=(k:PKey)=>{pkeyRef.current=k;setPkey(k);recompute();};
  const toggleTheme=()=>{const t:Theme=isDark?'light':'dark';themeRef.current=t;setTheme(t);};
  const toggleOpen=(i:number)=>setOpen(s=>({...s,[i]:!s[i]}));

  const part=PARTS[pkey], bLabel=B.toFixed(1), pLabel=momentum.toFixed(1);
  const num=(n:number)=>String(n).padStart(2,'0');
  const cssVars=mkVars(isDark) as React.CSSProperties;
  const dotC:Record<CK,string>=isDark
    ?{lep:'#8FE7F2',mu:'#A9B6F5',pi:'#2DE2FF',kao:'#D49A6B',pro:'#F0B33A'}
    :{lep:'#3EB6C9',mu:'#6E7BD0',pi:'#16B6D2',kao:'#B0744A',pro:'#D4862A'};

  const rootStyle:React.CSSProperties={
    ...cssVars, position:'relative', minHeight:'100vh', color:'var(--ink)',
    fontFamily:"'Noto Sans KR',system-ui,sans-serif", backgroundColor:'var(--paper)',
    backgroundImage:'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px),linear-gradient(var(--grid-strong) 1px,transparent 1px),linear-gradient(90deg,var(--grid-strong) 1px,transparent 1px)',
    backgroundSize:'26px 26px,26px 26px,130px 130px,130px 130px',
    transition:'background-color .45s ease,color .45s ease',
  };

  return (
    <div style={rootStyle}>
      {/* NAVBAR */}
      <nav style={{position:'sticky',top:0,zIndex:20,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,height:58,padding:'0 18px',background:'color-mix(in srgb,var(--paper) 82%,transparent)',backdropFilter:'blur(10px)',borderBottom:'1px solid var(--border)'}}>
        <a href="/" style={{display:'inline-flex',alignItems:'center',gap:9,textDecoration:'none',color:'var(--ink)',fontFamily:"'Sora','Noto Sans KR',sans-serif",fontWeight:600,fontSize:14}}>
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          <span style={{display:'inline-flex',alignItems:'center',gap:7}}>이삭 <span style={{color:'var(--accent-text)',fontWeight:600}}>ISAAC</span></span>
        </a>
        <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10.5,letterSpacing:'.16em',color:'var(--ink-soft)',whiteSpace:'nowrap'}}>검출기의 원리 · DETECTOR 101</span>
        <button onClick={toggleTheme} type="button" role="switch" aria-checked={isDark} aria-label={isDark?'검출기 홀 · NIGHT':'연구실 · DAY'}
          style={{position:'relative',width:60,height:32,flex:'0 0 auto',borderRadius:999,background:'var(--card-2)',border:'1px solid var(--border)',cursor:'pointer',padding:0,boxShadow:'var(--shadow)'}}>
          <span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:'var(--ink-soft)',display:'flex'}}>
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/></svg>
          </span>
          <span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',color:'var(--ink-soft)',display:'flex'}}>
            <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
          </span>
          <span style={{position:'absolute',top:3,left:3,width:24,height:24,borderRadius:'50%',background:'var(--cyan)',boxShadow:'0 0 10px var(--glow)',transition:'transform .3s cubic-bezier(.4,1.25,.5,1)',transform:isDark?'translateX(28px)':'translateX(0)'}}/>
        </button>
      </nav>

      {/* HERO */}
      <header style={{maxWidth:1320,margin:'0 auto',padding:'46px 24px 8px',textAlign:'center'}}>
        <span style={{display:'inline-flex',alignItems:'center',gap:7,fontFamily:"'IBM Plex Mono',monospace",fontSize:10.5,letterSpacing:'.16em',color:'var(--ink-soft)'}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--cyan)',boxShadow:'0 0 8px var(--glow)'}}/>EVENT DISPLAY · 측면도
        </span>
        <h1 style={{fontFamily:"'Sora','Noto Sans KR',sans-serif",fontWeight:700,fontSize:38,lineHeight:1.1,letterSpacing:'-.015em',margin:'14px 0 0',color:'var(--ink)'}}>
          검출기는 입자를 <span style={{color:'var(--accent-text)',fontWeight:600}}>어떻게 보는가</span>
        </h1>
        <p style={{maxWidth:560,margin:'14px auto 0',fontSize:15,lineHeight:1.65,color:'var(--ink-soft)'}}>
          한 장의 그림으로 따라가는 입자물리 실험의 기초. 옆의 컨트롤로 자기장·입자·운동량을 바꾸면 궤적이 즉시 반응합니다. 아래로 내려가며 (1)~(9)를 읽어보세요.
        </p>
      </header>

      {/* STAGE */}
      <div className="det-stage" style={{display:'flex',alignItems:'flex-start',gap:40,maxWidth:1320,margin:'0 auto',padding:'18px 24px 80px'}}>

        {/* STICKY COLUMN */}
        <div className="det-sticky" style={{position:'sticky',top:74,flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:14,alignSelf:'flex-start'}}>
          <div ref={wrapRef} className="det-canvas" style={{position:'relative',width:'100%',height:'calc(100vh - 230px)',minHeight:420,background:'var(--card)',border:'1px solid var(--border)',borderRadius:18,boxShadow:'var(--shadow)',overflow:'hidden'}}>
            <canvas ref={canvasRef} style={{display:'block',width:'100%',height:'100%'}}/>

            {/* B chip */}
            <div style={{position:'absolute',left:12,top:12,display:'flex',alignItems:'center',gap:7,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:'var(--ink)',background:'var(--card-2)',border:'1px solid var(--border)',borderRadius:999,padding:'5px 11px',boxShadow:'var(--shadow)'}}>
              <span style={{display:'inline-flex',width:13,height:13,borderRadius:'50%',border:'1.4px solid var(--mustard)',alignItems:'center',justifyContent:'center',color:'var(--mustard)',fontSize:9}}>✕</span>
              B = {bLabel} T
            </div>
            {/* particle chip */}
            <div style={{position:'absolute',right:12,top:12,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:'var(--ink)',background:'var(--card-2)',border:'1px solid var(--border)',borderRadius:999,padding:'5px 11px',boxShadow:'var(--shadow)'}}>
              {part.label} · p = {pLabel} GeV
            </div>

            {/* HUD bottom-left */}
            <div style={{position:'absolute',left:12,bottom:12,minWidth:158,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'9px 12px',boxShadow:'var(--shadow)',fontFamily:"'IBM Plex Mono',monospace"}}>
              <div style={{fontSize:8.5,letterSpacing:'.16em',color:'var(--ink-soft)',marginBottom:7}}>RECONSTRUCTED</div>
              <div style={{display:'flex',justifyContent:'space-between',gap:14,fontSize:11,lineHeight:1.9}}><span style={{color:'var(--ink-soft)'}}>반경 R</span><span style={{color:'var(--ink)'}}>{hud.R}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',gap:14,fontSize:11,lineHeight:1.9}}><span style={{color:'var(--ink-soft)'}}>p<sub>T</sub></span><span style={{color:'var(--accent-text)'}}>{hud.pT}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',gap:14,fontSize:11,lineHeight:1.9}}><span style={{color:'var(--ink-soft)'}}>β</span><span style={{color:'var(--ink)'}}>{hud.beta}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',gap:14,fontSize:11,lineHeight:1.9}}><span style={{color:'var(--ink-soft)'}}>Δt · TOF</span><span style={{color:'var(--ink)'}}>{hud.tof}</span></div>
            </div>

            {/* Energy bars bottom-right */}
            <div style={{position:'absolute',right:12,bottom:12,width:194,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'9px 12px',boxShadow:'var(--shadow)',fontFamily:"'IBM Plex Mono',monospace"}}>
              <div style={{fontSize:8.5,letterSpacing:'.16em',color:'var(--ink-soft)',marginBottom:8}}>ENERGY · GeV</div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{width:44,fontSize:10,color:'var(--ink-soft)'}}>EMCAL</span>
                <span style={{flex:1,height:8,borderRadius:4,background:'var(--card-2)',border:'1px solid var(--border)',overflow:'hidden',position:'relative'}}>
                  <span ref={emcalFillRef} style={{position:'absolute',left:0,top:0,bottom:0,width:'0%',background:'var(--cyan)',boxShadow:'0 0 8px var(--glow)'}}/>
                </span>
                <span style={{width:48,textAlign:'right',fontSize:10,color:'var(--ink)'}}>{hud.emE}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:44,fontSize:10,color:'var(--ink-soft)'}}>HCAL</span>
                <span style={{flex:1,height:8,borderRadius:4,background:'var(--card-2)',border:'1px solid var(--border)',overflow:'hidden',position:'relative'}}>
                  <span ref={hcalFillRef} style={{position:'absolute',left:0,top:0,bottom:0,width:'0%',background:'var(--copper)'}}/>
                </span>
                <span style={{width:48,textAlign:'right',fontSize:10,color:'var(--ink)'}}>{hud.hcE}</span>
              </div>
            </div>
          </div>

          {/* CONTROLS */}
          <div style={{display:'flex',flexWrap:'wrap',gap:'14px 24px',alignItems:'center',padding:'14px 16px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,boxShadow:'var(--shadow)'}}>
            <label style={{display:'flex',flexDirection:'column',gap:5,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:'.06em',color:'var(--ink-soft)'}}>
              <span>자기장 B · <span style={{color:'var(--ink)'}}>{bLabel} T</span></span>
              <input type="range" min={0.3} max={3} step={0.1} value={B} onChange={handleB} aria-label="자기장 세기" style={{width:140,accentColor:'var(--cyan)',cursor:'pointer'}}/>
            </label>
            <label style={{display:'flex',flexDirection:'column',gap:5,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:'.06em',color:'var(--ink-soft)'}}>
              <span>운동량 p · <span style={{color:'var(--ink)'}}>{pLabel} GeV</span></span>
              <input type="range" min={0.3} max={10} step={0.1} value={momentum} onChange={handleP} aria-label="운동량" style={{width:140,accentColor:'var(--cyan)',cursor:'pointer'}}/>
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:'.06em',color:'var(--ink-soft)'}}>입자 · 전하</span>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {ORDER.map(k=>{
                  const pp=PARTS[k], isSel=k===pkey;
                  return (
                    <button key={k} onClick={()=>handlePart(k)} type="button"
                      style={{position:'relative',display:'flex',alignItems:'center',gap:7,padding:'6px 11px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card-2)',color:'var(--ink)',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace"}}>
                      <span style={{width:9,height:9,borderRadius:'50%',background:dotC[pp.ck]}}/>
                      <span style={{display:'flex',flexDirection:'column',alignItems:'flex-start',lineHeight:1.1}}>
                        <span style={{fontSize:13,fontWeight:600}}>{pp.label}</span>
                        <span style={{fontSize:8.5,color:'var(--ink-soft)'}}>{pp.sub}</span>
                      </span>
                      {isSel&&<span style={{position:'absolute',inset:-1,borderRadius:11,border:'1.5px solid var(--cyan)',boxShadow:'0 0 0 3px var(--glow)',pointerEvents:'none'}}/>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* NARRATIVE STEPS */}
        <div ref={stepsRef} className="det-steps" style={{flex:'0 0 384px',width:384,display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'6px 0 2px',fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:'.16em',color:'var(--ink-soft)'}}>
            스크롤하며 읽기
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{animation:'hintbob 1.8s ease-in-out infinite'}}><path d="M12 5v14M6 13l6 6 6-6"/></svg>
          </div>

          {STEPS.map((st,i)=>{
            const idx=i+1, isActive=activeStep===idx, isOpen=!!open[idx];
            return (
              <div key={idx} data-step={idx} style={{position:'relative',minHeight:'74vh',display:'flex',flexDirection:'column',justifyContent:'center',padding:'18px 0'}}>
                <div style={{position:'relative',background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:'22px 22px 20px',boxShadow:'var(--shadow)',transition:'border-color .3s ease,box-shadow .3s ease'}}>
                  {isActive&&<span style={{position:'absolute',inset:-1,borderRadius:17,border:'1.5px solid var(--cyan)',boxShadow:'0 0 0 4px var(--glow)',pointerEvents:'none'}}/>}
                  <span style={{position:'absolute',left:-1,top:24,bottom:24,width:3,borderRadius:3,background:'var(--cyan)',opacity:isActive?1:0.18}}/>
                  <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:11}}>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,fontWeight:600,color:'var(--accent-text)',letterSpacing:'.04em'}}>{num(idx)}</span>
                    <span style={{flex:1,height:1,background:'linear-gradient(90deg,var(--border),transparent)'}}/>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:'.14em',color:'var(--ink-soft)'}}>{st.tag}</span>
                  </div>
                  <h2 style={{fontFamily:"'Sora','Noto Sans KR',sans-serif",fontWeight:600,fontSize:21,lineHeight:1.25,margin:'0 0 9px',color:'var(--ink)'}}>{st.title}</h2>
                  <p style={{margin:0,fontSize:14.5,lineHeight:1.7,color:'var(--ink-soft)'}}>{st.body}</p>
                  <button onClick={()=>toggleOpen(idx)} type="button"
                    style={{marginTop:14,display:'inline-flex',alignItems:'center',gap:7,padding:'7px 13px',borderRadius:9,border:'1px solid var(--border)',background:'var(--card-2)',color:'var(--accent-text)',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:'.04em',whiteSpace:'nowrap'}}>
                    <span style={{display:'inline-flex',width:13,height:13,alignItems:'center',justifyContent:'center'}}>
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.6 1.2c0 1.6-2.1 2-2.1 2"/><path d="M12 16.5h.01" strokeLinecap="round"/></svg>
                    </span>
                    {isOpen?'공식 닫기':'공식 보기'}
                  </button>
                  {isOpen&&(
                    <div style={{marginTop:12,padding:'13px 15px',background:'var(--card-2)',border:'1px solid var(--border)',borderRadius:11,borderLeft:'3px solid var(--cyan)'}}>
                      <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13.5,lineHeight:1.7,color:'var(--ink)',letterSpacing:'.01em'}}>{st.formula}</div>
                      <div style={{marginTop:7,fontSize:11.5,lineHeight:1.6,color:'var(--ink-soft)'}}>{st.formNote}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div style={{padding:'26px 4px 6px',borderTop:'1px solid var(--border)',marginTop:8}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:'.1em',color:'var(--ink-soft)',lineHeight:1.7}}>
              정리 — tracker는 <span style={{color:'var(--ink)'}}>어디로</span>(궤적·p<sub>T</sub>), TOF는 <span style={{color:'var(--ink)'}}>언제</span>(질량), 칼로리미터는 <span style={{color:'var(--ink)'}}>얼마나</span>(에너지)를 봅니다. 셋을 합치면 입자의 정체가 드러납니다.
            </div>
            <a href="/" style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:18,fontFamily:"'Sora','Noto Sans KR',sans-serif",fontWeight:600,fontSize:13,color:'var(--accent-text)',textDecoration:'none'}}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              이삭 ISAAC 링크 허브로 돌아가기
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hintbob { 0%,100%{ transform:translateY(0); opacity:.6 } 50%{ transform:translateY(5px); opacity:1 } }
        @media (max-width:860px){
          .det-stage{ flex-direction:column !important; gap:8px !important; }
          .det-sticky{ position:sticky !important; top:58px !important; width:auto !important; flex:none !important; }
          .det-canvas{ height:46vh !important; }
          .det-steps{ flex:none !important; width:auto !important; }
          .det-steps [data-step]{ min-height:62vh !important; }
        }
      `}</style>
    </div>
  );
}
