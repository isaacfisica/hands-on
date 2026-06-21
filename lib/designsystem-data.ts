export interface AccentSwatch {
  name: string;
  token: string;
  css: string;
  light: string;
  dark: string;
}

export interface SurfaceSwatch {
  name: string;
  token: string;
  css: string;
}

export interface TypeScaleItem {
  meta: string;
  font: string;
  weight: number;
  px: string;
  sample: string;
}

export interface RadiusItem {
  label: string;
  px: string;
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { name: 'Cyan · 시그널', token: '--cyan', css: 'var(--cyan)', light: '#16B6D2', dark: '#2DE2FF' },
  { name: 'Accent Text', token: '--accent-text', css: 'var(--accent-text)', light: '#0C8499', dark: '#62ECFF' },
  { name: 'Copper · 회로', token: '--copper', css: 'var(--copper)', light: '#AF724A', dark: '#D49A6B' },
  { name: 'Mustard · 자기장', token: '--mustard', css: 'var(--mustard)', light: '#D49A26', dark: '#E7B33E' },
];

export const SURFACE_SWATCHES: SurfaceSwatch[] = [
  { name: 'Paper · 배경', token: '--paper', css: 'var(--paper)' },
  { name: 'Paper 2', token: '--paper-2', css: 'var(--paper-2)' },
  { name: 'Card · 카드', token: '--card', css: 'var(--card)' },
  { name: 'Card 2', token: '--card-2', css: 'var(--card-2)' },
  { name: 'Tile · 아이콘', token: '--tile', css: 'var(--tile)' },
  { name: 'Ink · 텍스트', token: '--ink', css: 'var(--ink)' },
  { name: 'Ink Soft', token: '--ink-soft', css: 'var(--ink-soft)' },
  { name: 'Border', token: '--border', css: 'var(--border)' },
];

export const TYPE_SCALE: TypeScaleItem[] = [
  { meta: 'Sora 700 · 40', font: "'Sora',sans-serif", weight: 700, px: '40px', sample: '검출기는 입자를 본다' },
  { meta: 'Sora 700 · 31', font: "'Sora',sans-serif", weight: 700, px: '31px', sample: '이삭 ISAAC' },
  { meta: 'Sora 600 · 16', font: "'Sora',sans-serif", weight: 600, px: '16px', sample: 'YouTube 메인 채널' },
  { meta: 'Noto 400 · 15', font: "'Noto Sans KR',sans-serif", weight: 400, px: '15px', sample: '이탈리아에서 입자 부수는 물리 VTuber' },
  { meta: 'Mono 500 · 11', font: "'IBM Plex Mono',monospace", weight: 500, px: '11px', sample: 'REC · ISAAC-2026' },
];

export const RADII: RadiusItem[] = [
  { label: '12px · tile', px: '12px' },
  { label: '14px · card', px: '14px' },
  { label: '15px · link', px: '15px' },
  { label: '999px · pill', px: '999px' },
];
