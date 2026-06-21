# CLAUDE.md — 이삭 ISAAC Link Hub (Handson 실습 레포)

## 프로젝트 개요

이삭(Isaac)의 개인 포트폴리오 겸 링크 허브 사이트 **실습용 스타터 레포**.
원본 사이트(`isaac-fisica-kr`)에서 컴포넌트를 제거한 뼈대 상태로, 직접 구현하는 것이 목적.

- **메인 페이지 (`/`)**: 링크 허브 + 물리 테마 시각 효과 → `FrontPage.tsx` 에서 구현
- **배포 대상**: GitHub Pages (isaacfisica.github.io), 정적 Next.js export

---

## 현재 구현 상태

| 파일 | 상태 |
|------|------|
| `app/layout.tsx` | ✅ 제공됨 (Navbar·Footer import는 구현 필요) |
| `app/page.tsx` | ✅ 제공됨 (FrontPage 렌더) |
| `components/FrontPage.tsx` | ⬜ 빈 스텁 — 직접 구현 |
| `lib/data.ts` | ✅ 콘텐츠 데이터 완비 |
| `lib/theme-context.tsx` | ✅ 전역 테마 상태 제공 |
| `design-system/globals.css` | ✅ 디자인 토큰·유틸리티 클래스 제공 |
| `design-system/blocks.tsx` | ✅ 블록카드 컴포넌트 제공 |
| `components/navbar.tsx` | ⬜ 미구현 (layout.tsx에서 import) |
| `components/footer.tsx` | ⬜ 미구현 (layout.tsx에서 import) |
| `app/fx.css` | ⬜ 미구현 (layout.tsx에서 import) |

> `navbar.tsx`, `footer.tsx`, `app/fx.css` 없이는 빌드 불가. 구현하거나 layout.tsx에서 임시 제거 필요.

---

## 기술 스택

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Styling**: 순수 CSS (Tailwind 없음) + CSS custom properties (토큰 기반 라이트/다크 테마)
- **외부 UI 라이브러리 없음** — 모든 컴포넌트 직접 구현
- **배포**: GitHub Actions → GitHub Pages (정적 export)
- **Analytics**: Google Analytics 4 (`NEXT_PUBLIC_GA_ID=G-LT8GYGQ80X`)

---

## 디렉토리 구조

```
isaac-fisica-kr-handson/
├── app/
│   ├── layout.tsx        # 루트 레이아웃 (GA 스크립트, 폰트, Navbar·Footer import)
│   ├── page.tsx          # 홈 → FrontPage 컴포넌트 렌더
│   └── fx.css            # ⬜ 이펙트 패널 스타일 (미구현)
├── components/
│   ├── FrontPage.tsx     # ⬜ 메인 페이지 컴포넌트 (빈 스텁)
│   ├── navbar.tsx        # ⬜ 상단 네비게이션 (미구현)
│   └── footer.tsx        # ⬜ 글로벌 푸터 (미구현)
├── lib/
│   ├── data.ts           # 콘텐츠 중앙 관리 (링크, 프로필, FX 기본값, about 객체)
│   ├── designsystem-data.ts # 디자인 시스템 뷰어 데이터
│   └── theme-context.tsx # 전역 테마 상태 — ThemeProvider, useTheme (light/dark)
├── design-system/
│   ├── globals.css       # 디자인 토큰(:root) + 전체 레이아웃 스타일 + DS 유틸리티 클래스
│   ├── blocks.tsx        # 블록카드 + DS 공용 컴포넌트
│   └── blocks.md         # blocks.tsx 사용 가이드
└── public/               # 정적 자산 (캐릭터 이미지)
```

---

## 콘텐츠 수정 위치

**콘텐츠 변경은 대부분 `lib/data.ts` 한 파일에서 완결됩니다.**

| 수정 항목 | 파일 |
|-----------|------|
| 링크 추가/수정/삭제 | `lib/data.ts` → `links` 배열 |
| 프로필 이름/소개 | `lib/data.ts` → `profile` 객체 |
| About 콘텐츠 | `lib/data.ts` → `about` 객체 |
| 푸터 소셜 아이콘 | `lib/data.ts` → `footerSocials` 배열 |
| 확장 슬롯 활성화 | `lib/data.ts` → `showSlots = true` |
| FX 이펙트 기본값 | `lib/data.ts` → `fxDefaults` |

---

## 스타일 시스템

### 테마 구조
- **전역 상태**: `lib/theme-context.tsx` — `ThemeProvider` + `useTheme()` hook
- `ThemeProvider`는 `app/layout.tsx`에서 Navbar와 children을 감쌉니다
- 테마 전환 시 `document.documentElement`에 `data-theme` 속성 설정
- **라이트 테마**: `:root` (기본, "실험실 벤치" 콘셉트)
- **다크 테마**: `[data-theme="dark"]` — html 요소에 적용되어 전역 토큰 교체

### 주요 CSS 변수 (토큰) — `design-system/globals.css` `:root`에 정의
```css
--paper       /* 배경 */
--paper-2     /* 보조 배경 */
--card        /* 카드 배경 */
--card-2      /* 카드 보조 배경 */
--ink         /* 주요 텍스트 */
--ink-soft    /* 보조 텍스트 */
--ink-faint   /* 흐린 텍스트 */
--cyan        /* 강조색 (링크 hover, 포커스 등) */
--accent-text /* 강조 텍스트 */
--copper      /* 보조 강조 */
--mustard     /* 3차 강조 */
--tile        /* 아이콘 타일 배경 (항상 다크) */
--tile-ink    /* 아이콘 타일 전경 */
--glow        /* cyan 발광 효과 */
--shadow      /* 카드 그림자 */
--border      /* 테두리 */
```

### 디자인 시스템 유틸리티 클래스 (`design-system/globals.css`)
```css
.ds-card             /* 표준 카드 */
.ds-link-card        /* hover: translateY(-2px) + cyan ring */
.ds-pill             /* hover: border-color → --cyan */
.ds-grid-2/3/4       /* 반응형 그리드 */
.ds-section-head     /* 번호+라벨+페이드 라인 헤더 */
.ds-card-label       /* 모노 소문자 카드 캡션 */
```

### 폰트
- `Sora` (헤딩, 500/600/700)
- `Noto Sans KR` (한국어 본문, 400/500/700)
- `IBM Plex Mono` (기술적 UI 요소, 400/500/600)

---

## 블록카드 시스템 (`design-system/blocks.tsx`)

프리셋 컴포넌트를 `<BlockGrid>` 안에 배치해 페이지를 조립하는 구조.
상세 사용법: `design-system/blocks.md`

| 컴포넌트 | 역할 |
|----------|------|
| `BlockGrid` | 2열 CSS 그리드 래퍼 |
| `Block` | 범용 셸 (full/bar/code/accent props) |
| `QuoteBlock` | 한 줄 소개 — 전체 너비 + 상단 cyan 바 |
| `ProfileBlock` | key/value 테이블 |
| `TagBlock` | 태그 묶음 |
| `TextBlock` | 긴 본문 텍스트 |
| `EmptyBlock` | 자리표시 점선 카드 |
| `DSCard` | 표준 카드 컨테이너 |
| `DSGrid` | 반응형 그리드 (cols: 2\|3\|4) |
| `IconTile` | 다크 타일 아이콘 래퍼 |
| `DSSectionHead` | 번호 + 라벨 + 페이드 라인 섹션 헤더 |
| `DSCardLabel` | 모노 소문자 캡션 |

---

## 빌드 & 개발

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 정적 빌드 → ./out 디렉토리
npm run lint     # ESLint
```

> 빌드 전에 `navbar.tsx`, `footer.tsx`, `app/fx.css` 구현 필요.
> 임시로 `app/layout.tsx`에서 해당 import를 주석 처리하면 FrontPage 단독 개발 가능.

---

## 자주 쓰는 패턴

### 테마별 스타일 추가
```css
/* :root 토큰이 전역으로 적용되므로 별도 다크 오버라이드 불필요 */
.my-element { color: var(--ink); }

/* 다크 모드에서만 다른 값이 필요한 경우 */
[data-theme="dark"] .my-element { color: var(--cyan); }
```

### useTheme 사용
```tsx
'use client';
import { useTheme } from '@/design-system/theme-context';

export default function MyComponent() {
  const { isDark, toggle } = useTheme();
  return <button onClick={toggle}>{isDark ? '다크' : '라이트'}</button>;
}
```

### 새 링크 추가
```ts
// lib/data.ts
export const links: LinkItem[] = [
  { icon: 'youtube', label: 'YouTube', sub: '@isaac.fisica', url: 'https://...' },
];
```
