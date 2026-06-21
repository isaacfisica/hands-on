import type { IconName } from '@/lib/data';

const DEFAULT_SIZE: Record<IconName, number> = {
  youtube: 22,
  stream: 22,
  x: 19,
  twitter: 20,
  discord: 22,
  support: 21,
};

/* 플랫폼 아이콘 — 새 아이콘이 필요하면 IconName에 키를 추가하고
   아래 switch에 case를 하나 더 넣으세요. */
export function LinkIcon({ name, size }: { name: IconName; size?: number }) {
  const s = size ?? DEFAULT_SIZE[name];
  switch (name) {
    case 'youtube':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .7 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.3 12 31 31 0 0 0 23 7.5ZM9.8 15.3V8.7l5.7 3.3Z" />
        </svg>
      );
    case 'stream':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="6" width="14" height="12" rx="2" />
          <path d="M8.5 10.5 12 12 8.5 13.5z" fill="currentColor" stroke="none" />
          <path d="M19.5 8.2c1.3 1.4 1.3 6.2 0 7.6M22 5.6c2.4 2.6 2.4 10.2 0 12.8" />
        </svg>
      );
    case 'x':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.1L4 21H1l7.5-8.6L.6 3H7l4.5 5.6L17.5 3Zm-1.1 16h1.7L7.7 4.8H5.9L16.4 19Z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 22.4 1s-2 .9-3.13 1.14A4.48 4.48 0 0 0 11.5 6.5c0 .35.04.7.1 1.03A12.73 12.73 0 0 1 2 2s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
        </svg>
      );
    case 'discord':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.5 5.6A16 16 0 0 0 15.6 4.4l-.2.4a14.8 14.8 0 0 1 3.3 1.3 12.5 12.5 0 0 0-10.8 0A14.8 14.8 0 0 1 11.2 4.8L11 4.4A16 16 0 0 0 7.1 5.6C3.6 10.8 2.7 15.8 3.1 20.8a16.2 16.2 0 0 0 4.9 2.5l.4-.6c-.8-.3-1.5-.6-2.2-1l.5-.4a11.6 11.6 0 0 0 9.9 0l.5.4c-.7.4-1.4.7-2.2 1l.4.6a16.1 16.1 0 0 0 4.9-2.5c.5-5.8-.9-10.7-3.7-15.2ZM9.3 17c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm5.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
        </svg>
      );
    case 'support':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 21s-7.4-4.6-9.6-9A5.1 5.1 0 0 1 12 6.6 5.1 5.1 0 0 1 21.6 12C19.4 16.4 12 21 12 21Z" />
        </svg>
      );
  }
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function AtomIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

/* ---------- 블록 시스템(design-system/blocks.tsx) 라벨 아이콘 ---------- */
export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.4-4.6-9.6-9A5.1 5.1 0 0 1 12 6.6 5.1 5.1 0 0 1 21.6 12C19.4 16.4 12 21 12 21Z" />
    </svg>
  );
}

export function FrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.2-1.5 4-1.5S16 14 16 14" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16M4 10h16M4 15h11M4 20h7" />
    </svg>
  );
}

/* ---------- 확장 블록 아이콘 ---------- */

/** 언어 — 말풍선 */
export function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h1M12 9h4M8 12.5h8" />
    </svg>
  );
}

/** 목표 — 과녁 */
export function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 과학·실험 — 플라스크 */
export function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6M9 3v6.5L4.5 17A2 2 0 0 0 6.3 20h11.4A2 2 0 0 0 19.5 17L15 9.5V3" />
      <path d="M7.5 15.5h9" />
    </svg>
  );
}

/** 연구·탐색 — 돋보기 */
export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

/** 국제·글로벌 — 지구본 */
export function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-2.5 4-2.5 14 0 18M12 3c2.5 4 2.5 14 0 18" />
    </svg>
  );
}

/** 학습·교육 — 책 */
export function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

/** 거점·위치 — 지도 핀 */
export function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-7.3-7-11a7 7 0 0 1 14 0c0 3.7-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** 특별·관심 — 별 */
export function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true">
      <path d="M12 3 14.2 8.9 20.6 9.2 15.6 13.2 17.3 19.3 12 15.8 6.7 19.3 8.4 13.2 3.4 9.2 9.8 8.9Z" />
    </svg>
  );
}

/** 수상·업적 — 트로피 */
export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4" />
      <path d="M5 3H3v4a4 4 0 0 0 4 4h0M19 3h2v4a4 4 0 0 1-4 4h0" />
      <path d="M5 3h14v7a7 7 0 0 1-7 7 7 7 0 0 1-7-7V3z" />
    </svg>
  );
}

/** 일정·날짜 — 달력 */
export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

/** 게임·취미 — 게임패드 */
export function GamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 11h4M8 9v4M15 12h.01M18 11h.01" />
      <path d="M4 7h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    </svg>
  );
}

/** 이메일 — 봉투 */
export function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

/** 링크·연결 — 체인 */
export function LinkChainIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export const all_icons = [
  {name: 'Sun', icon: SunIcon},
  {name: 'Moon', icon: MoonIcon},
  {name: 'Atom', icon: AtomIcon},
  {name: 'Arrow', icon: ArrowIcon},
  {name: 'Plus', icon: PlusIcon},
  {name: 'User', icon: UserIcon},
  {name: 'Heart', icon: HeartIcon},
  {name: 'Frown', icon: FrownIcon},
  {name: 'List', icon: ListIcon},
  {name: 'Target', icon: TargetIcon},
  {name: 'Flask', icon: FlaskIcon},
  {name: 'Search', icon: SearchIcon},
  {name: 'Globe', icon: GlobeIcon},
  {name: 'Book', icon: BookIcon},
  {name: 'MapPin', icon: MapPinIcon},
  {name: 'Star', icon: StarIcon},
  {name: 'Trophy', icon: TrophyIcon},
  {name: 'Calendar', icon: CalendarIcon},
  {name: 'Gamepad', icon: GamepadIcon},
  {name: 'Email', icon: EmailIcon},
  {name: 'LinkChain', icon: LinkChainIcon}
];