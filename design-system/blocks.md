# blocks.tsx 사용 가이드

`design-system/blocks.tsx`는 페이지를 블록카드 방식으로 조립하는 프리셋 컴포넌트 모음입니다.
새 페이지를 만들 때 이 컴포넌트들을 조합해 빠르게 레이아웃을 구성할 수 있습니다.

---

## 레이아웃 컴포넌트

### `BlockGrid`

About 페이지 등 블록카드 배열에 쓰는 **2열 CSS 그리드** 래퍼.
내부 블록은 `full` prop으로 전체 너비를 차지할 수 있습니다.

```tsx
import { BlockGrid } from '@/design-system/blocks';

<BlockGrid>
  <QuoteBlock>…</QuoteBlock>
  <TagBlock label="LIKES" tags={[…]} />
  <TagBlock label="DISLIKES" accent="copper" tags={[…]} />
  <TextBlock label="STORY">…</TextBlock>
</BlockGrid>
```

### `DSGrid`

**반응형 그리드** — 2·3·4열 레이아웃. 디자인 시스템 뷰어나 콘텐츠 그리드에 사용.
모바일에서 자동으로 열 수를 줄입니다 (`design-system/globals.css` `.ds-grid-N` 클래스 기반).

| prop | 타입 | 설명 |
|------|------|------|
| `cols` | `2 \| 3 \| 4` | 열 수 |
| `style` | `CSSProperties` | 추가 스타일 (예: `marginBottom`) |

```tsx
import { DSGrid, DSCard } from '@/design-system/blocks';

// 4열, 모바일에서 2열
<DSGrid cols={4}>
  <DSCard style={{ padding: 16 }}>카드 1</DSCard>
  <DSCard style={{ padding: 16 }}>카드 2</DSCard>
</DSGrid>

// 3열 + 아래 마진
<DSGrid cols={3} style={{ marginBottom: 14 }}>
  …
</DSGrid>
```

### `DSCard`

표준 **카드 컨테이너** — 배경(`--card`), 테두리, 라운드(14px), 그림자를 적용합니다.
`cardStyle` 객체를 직접 쓰는 대신 이 컴포넌트를 사용하세요.

| prop | 타입 | 설명 |
|------|------|------|
| `style` | `CSSProperties` | padding·overflow 등 추가 스타일 |
| `className` | `string` | 추가 CSS 클래스 |

```tsx
import { DSCard } from '@/design-system/blocks';

<DSCard style={{ padding: 20 }}>
  내용
</DSCard>

// overflow 필요한 경우 (스와치 카드 등)
<DSCard style={{ overflow: 'hidden' }}>
  <div style={{ height: 80, background: 'var(--cyan)' }} />
  <div style={{ padding: 12 }}>라벨</div>
</DSCard>
```

---

## 블록 프리셋 (BlockGrid 내부용)

### `Block`

모든 블록의 **범용 셸**. 직접 쓰거나 새 프리셋을 만들 때 활용합니다.

| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `full` | `boolean` | `false` | 그리드 2칸 전체 너비 |
| `bar` | `boolean` | `false` | 상단 액센트 바 |
| `label` | `string` | — | 헤더 라벨 |
| `icon` | `ReactNode` | — | 라벨 앞 아이콘 |
| `accent` | `'cyan' \| 'copper' \| 'mustard' \| 'accent'` | `'accent'` | 강조색 |
| `code` | `boolean` | `false` | 라벨을 `// 주석` 스타일로 렌더 |

```tsx
import { Block } from '@/design-system/blocks';
import { StarIcon } from '@/components/icons';

<Block full bar accent="cyan" label="CUSTOM" icon={<StarIcon />}>
  <p>원하는 내용</p>
</Block>
```

### `QuoteBlock`

**한 줄 소개** — 전체 너비 + 상단 cyan 바 + 큰 강조 문구.

```tsx
<QuoteBlock>물리학으로 세상을 설명하는 사람.</QuoteBlock>

// 라벨 변경
<QuoteBlock label="// 슬로건">우주의 언어는 수학이다.</QuoteBlock>
```

### `ProfileBlock`

**key/value 테이블** — 프로필 정보 나열.

```tsx
import { ProfileBlock } from '@/design-system/blocks';

<ProfileBlock
  label="PROFILE"
  rows={[
    { k: '이름', v: 'Isaac' },
    { k: '소속', v: '물리학과' },
    { k: '분야', v: '실험 핵·입자물리학' },
    { k: '국적', v: '대한민국 🇰🇷' },
  ]}
/>
```

### `TagBlock`

**태그 묶음** — 좋아하는 것, 기술 스택 등 나열.
기본 절반 너비 (BlockGrid 내 2칸 중 1칸).

| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | `string` | — | 헤더 라벨 (필수) |
| `tags` | `string[]` | — | 태그 목록 (필수) |
| `accent` | `BlockAccent` | `'cyan'` | 강조색 |
| `icon` | `ReactNode` | — | 라벨 아이콘 |
| `full` | `boolean` | `false` | 전체 너비 |

```tsx
import { TagBlock } from '@/design-system/blocks';
import { HeartIcon, FrownIcon } from '@/components/icons';

<TagBlock label="LIKES"    accent="cyan"   icon={<HeartIcon />} tags={['물리', '게임', '음악']} />
<TagBlock label="DISLIKES" accent="copper" icon={<FrownIcon />} tags={['페이퍼워크', '더위']} />
```

### `TextBlock`

**긴 본문** — 설명·스토리 등 자유 텍스트. 기본 전체 너비.

```tsx
import { TextBlock } from '@/design-system/blocks';
import { ListIcon } from '@/components/icons';

<TextBlock label="AIMS" accent="mustard" icon={<ListIcon />}>
  물리학을 더 많은 사람에게 재미있게 전달하는 것이 목표입니다.
  유튜브와 SNS를 통해 실험·시뮬레이션 콘텐츠를 제작합니다.
</TextBlock>
```

### `EmptyBlock`

**빈 자리표시 블록** — 점선 카드. 아직 채우지 않은 섹션에 사용.

```tsx
import { EmptyBlock } from '@/design-system/blocks';

<EmptyBlock />
<EmptyBlock>준비 중인 섹션입니다</EmptyBlock>
```

---

## DS 공용 컴포넌트

### `IconTile`

링크 카드의 **다크 타일 아이콘 래퍼** — 항상 다크 배경 + 시안 도트.

```tsx
import { IconTile } from '@/design-system/blocks';
import { LinkIcon } from '@/components/icons';

<IconTile>
  <LinkIcon name="youtube" />
</IconTile>
```

### `DSSectionHead`

**섹션 헤더** — 번호 + 라벨 + 오른쪽으로 페이드되는 선.

```tsx
import { DSSectionHead } from '@/design-system/blocks';

<DSSectionHead no="01" label="ABOUT · 소개" />
<DSSectionHead no="02" label="LINKS · 링크" />
```

### `DSCardLabel`

**모노스페이스 캡션** — 카드 내 소제목·설명 라벨.

```tsx
import { DSCardLabel } from '@/design-system/blocks';

<DSCardLabel>RADIUS · 모서리</DSCardLabel>
<DSCardLabel style={{ marginBottom: 12 }}>아이콘 목록</DSCardLabel>
```

---

## 새 페이지 만들기 — 전체 예시

`BlockGrid` 기반의 소개 페이지:

```tsx
'use client';

import {
  BlockGrid, QuoteBlock, ProfileBlock,
  TagBlock, TextBlock, EmptyBlock,
} from '@/design-system/blocks';
import { HeartIcon, ListIcon } from '@/components/icons';

export default function MyPage() {
  return (
    <div className="hub">
      <h1>새 페이지</h1>
      <BlockGrid>
        <QuoteBlock>한 줄 소개 문구</QuoteBlock>

        <ProfileBlock
          rows={[
            { k: '이름', v: '홍길동' },
            { k: '역할', v: '풀스택 개발자' },
          ]}
        />

        <TagBlock
          label="SKILLS"
          accent="cyan"
          icon={<HeartIcon />}
          tags={['TypeScript', 'React', 'Next.js']}
        />
        <TagBlock
          label="TOOLS"
          accent="mustard"
          tags={['Figma', 'VS Code', 'GitHub']}
        />

        <TextBlock label="ABOUT" icon={<ListIcon />}>
          자기소개 본문이 여기 들어갑니다.
        </TextBlock>

        <EmptyBlock />
      </BlockGrid>
    </div>
  );
}
```

`DSGrid` + `DSCard` 기반의 그리드 콘텐츠 페이지:

```tsx
'use client';

import { DSGrid, DSCard, DSSectionHead, DSCardLabel } from '@/design-system/blocks';

export default function GridPage() {
  const items = ['항목 A', '항목 B', '항목 C', '항목 D'];

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 28px' }}>
      <DSSectionHead no="01" label="ITEMS · 항목" />
      <DSGrid cols={4}>
        {items.map((item) => (
          <DSCard key={item} style={{ padding: 20 }}>
            <DSCardLabel>{item}</DSCardLabel>
            <p>설명 텍스트</p>
          </DSCard>
        ))}
      </DSGrid>

      <DSSectionHead no="02" label="DETAIL · 상세" />
      <DSGrid cols={2}>
        <DSCard style={{ padding: 24 }}>왼쪽 패널</DSCard>
        <DSCard style={{ padding: 24 }}>오른쪽 패널</DSCard>
      </DSGrid>
    </main>
  );
}
```

---

## 스타일 참고

- 모든 컴포넌트는 `design-system/globals.css`의 CSS 변수(토큰)를 사용합니다.
- 테마 전환은 `document.documentElement`의 `data-theme` 속성으로 자동 처리됩니다.
- 새 accent 색이 필요하면 `BlockAccent` 타입과 `ACCENT_VAR` 맵을 `design-system/blocks.tsx`에 추가하세요.
- 블록 스타일은 `design-system/globals.css`의 `.block-*` 클래스에 정의되어 있습니다.
- DS 컴포넌트 스타일은 `design-system/globals.css`의 `.ds-*` 클래스에 정의되어 있습니다.

실제 사용 예시는 [components/About.tsx](../components/About.tsx)와 [app/example/page.tsx](../app/example/page.tsx)를 참고하세요.
