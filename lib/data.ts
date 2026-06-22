/**
 * ────────────────────────────────────────────────────────────────────
 *  콘텐츠 데이터 — 거의 모든 수정은 이 파일에서 끝납니다.
 * ────────────────────────────────────────────────────────────────────
 *  ▷ 링크 추가/수정 : links 배열에 항목을 추가하거나 url을 바꾸세요.
 *       icon: youtube | stream | x | twitter | discord | support
 *       새 아이콘이 필요하면 components/icons.tsx 의 LinkIcon에 한 줄 추가.
 *  ▷ 확장 슬롯       : slots 배열 (지금은 '준비 중' placeholder).
 *  ▷ 푸터 소셜       : footerSocials 배열.
 *  ▷ showSlots=false  로 두면 확장 슬롯 섹션이 통째로 숨겨집니다.
 */

import type { IconName } from '@/design-system/icons';

export interface LinkItem {
  icon: IconName;
  label: string;
  sub: string;
  url: string;
}

export interface SlotItem {
  label: string;
  note: string;
}

export interface SocialItem {
  icon: IconName;
  label: string;
  url: string;
}

/* 메인 링크 — url의 "#" 자리에 실제 주소를 넣으세요. */
export const links: LinkItem[] = [

  { icon: 'stream', label: '라이브 스트리밍', sub: 'CHZZK', url: 'https://chzzk.naver.com/live/271d3c1c873ad6e013f2524ea705045c' }, // 여기에 링크
  { icon: 'twitter', label: 'Twitter (X)', sub: '@isaacfisica_kr', url: 'https://x.com/isaacfisica_kr' }, // 여기에 링크
  { icon: 'youtube', label: 'YouTube', sub: 'Youtube', url: 'https://www.youtube.com/@isaac.fisica' }, // 여기에 링크
  //   //{ icon: 'discord', label: 'Discord', sub: '커뮤니티 서버', url: '#' }, // 여기에 링크
  //{ icon: 'support', label: '후원 · 멤버십', sub: '채널 멤버십 / 슈퍼챗', url: '#' }, // 여기에 링크
];

/* 확장 슬롯 — 추후 활성화 시 위 links 처럼 실제 섹션으로 교체 */
export const slots: SlotItem[] = [
  { label: 'Live · 최신 영상', note: '준비 중' },
  { label: '방송 스케줄', note: '준비 중' },
  { label: 'About 이삭', note: '준비 중' },
  { label: 'FAQ', note: '준비 중' },
];

/* 푸터 소셜 아이콘 줄 */
export const footerSocials: SocialItem[] = [
  { icon: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@isaac.fisica' },
  { icon: 'stream', label: 'CHZZK', url: 'https://chzzk.naver.com/live/271d3c1c873ad6e013f2524ea705045c' },
  { icon: 'twitter', label: 'Twitter (X)', url: 'https://x.com/isaacfisica_kr' },
  // { icon: 'discord', label: 'Discord', url: '#' },
];

/* 프로필 */
export const profile = {
  nameKo: '이삭',
  nameEn: 'ISAAC',
  tagline: '물리학과 박사과정 // 실험 핵·입자물리학; 국제공동연구 // 이탈리아 대학 재학중',
  chips: ['물리 교양', '게임'],
  recTag: 'REC · ISAAC',
  copyright: '© 2025-2026 이삭 ISAAC',
  footnote: 'Character designed by BOOTH 扇屋敷の絵画工房',
  email: 'isaac.fisica.krNOSPAM[at]gmail.com'
};

/* 확장 슬롯 섹션 표시 여부 */
export const showSlots = false;


/* ────────────────────────────────────────────────────────────────────
   About(자기소개) 페이지 콘텐츠 — 블록카드 시스템(design-system/blocks.tsx)에서 사용.
   각 항목 텍스트만 고치면 페이지가 갱신됩니다.
   ──────────────────────────────────────────────────────────────────── */
export interface ProfileRowItem {
  k: string;
  v: string;
}

export const about: {
  quote: string;
  profile: ProfileRowItem[];
  likes: string[];
  dislikes: string[];
  aims: string;
  research: string[];
} = {
  quote: '',
  profile: [
    { k: '이름', v: '이삭' },
    { k: '전공', v: '실험 핵/입자물리학' },
    { k: '거주 국가', v: '이탈리아' },
    { k: '국적', v: '대한민국' },
    { k: '언어', v: '한국어(MT), 영어(C1), 프랑스어(A1), 이탈리아어, 일본어' },
    { k: '주요 거점', v: 'MLO NAP GVA SEL PUS' }
  ],
  likes: ['에어컨'],
  dislikes: ['스파게티 부수기', '카페 아메리카노'],
  aims: "물리학 연구가, 물리학 공부가 어렵지 않다는 것을 보여주는 것을 지향합니다. 물리는 자연에 대한 철학이며, 세상을 바라보는 하나의 관점입니다. 물리학적 지식은 세상을 이해하는데 도움을 줘야할 뿐, 그것을 공부하는 과정에서 고통받지 않도록 그 두려움을 더는 것을 목표로 합니다.",
  research:
    [
      '양자색역학적 상전이 (QCD Phase Transition)',
      '반도체 기반 방사선 검출기',
      '고에너지 핵/입자물리실험을 위한 반도체 기초 연구',
      '암흑물질 탐색을 위한 반도체 기초 연구',
      '초고속 데이터 수집과 대용량 데이터 처리에 대한 기초 연구',
      '방사선의 물질 내 반응에 대한 전산모사 (GEANT4)',
      '한국-이탈리아 및 한국-유럽 국제공동연구',
    ]
};

/* ────────────────────────────────────────────────────────────────────
   FX 기믹 기본값 (런타임 패널로 on/off 가능)
   - pcb    : 전류가 흐르는 PCB 회로 배경 애니메이션
   - tracks : 프로필 사진 클릭 → 이벤트 디스플레이 트랙 분출
   - decay  : 배경 클릭 → Λ⁰ → p + π⁻ 붕괴 애니메이션
   - multiplicity : 프로필 클릭 시 생성되는 트랙(입자) 개수
   ──────────────────────────────────────────────────────────────────── */
export const fxDefaults = {
  pcb: true,
  tracks: true,
  decay: true,
  multiplicity: 14,
};
