/**
 * ────────────────────────────────────────────────────────────────────
 *  블록 카드 시스템 — "블록카드식" 페이지(About 등)를 조립하는 프리셋 컴포넌트.
 * ────────────────────────────────────────────────────────────────────
 *  ▷ 스타일      : design-system/globals.css 의 .block-* 클래스에 미리 정의되어 있습니다.
 *  ▷ 토큰        : var(--card) 등 테마 토큰을 사용합니다.
 *                 :root 에 정의되어 있으므로 어디서든 동작합니다.
 *  ▷ accent      : 라벨 아이콘/상단 바 색 — 'cyan' | 'copper' | 'mustard' | 'accent'
 *
 *  사용 예 (components/About.tsx 참고):
 *    <BlockGrid>
 *      <QuoteBlock>한 줄 소개…</QuoteBlock>
 *      <ProfileBlock rows={[{ k: '데뷔', v: '…' }]} />
 *      <TagBlock label="LIKES"  accent="cyan"   icon={<HeartIcon />} tags={[…]} />
 *      <TagBlock label="DISLIKES" accent="copper" icon={<FrownIcon />} tags={[…]} />
 *      <TextBlock label="STORY" accent="mustard" icon={<ListIcon />}>본문…</TextBlock>
 *      <EmptyBlock />
 *    </BlockGrid>
 *
 *  새 블록 종류가 필요하면 <Block> 셸을 감싸 프리셋을 하나 더 만드세요.
 */

import type { ReactNode, CSSProperties } from 'react';
import { UserIcon, PlusIcon } from '@/components/icons';

export type BlockAccent = 'cyan' | 'copper' | 'mustard' | 'accent';

const ACCENT_VAR: Record<BlockAccent, string> = {
  cyan: 'var(--cyan)',
  copper: 'var(--copper)',
  mustard: 'var(--mustard)',
  accent: 'var(--accent-text)',
};

/* ---------- 레이아웃 래퍼 (2열 그리드) ---------- */
export function BlockGrid({ children }: { children: ReactNode }) {
  return <div className="block-grid">{children}</div>;
}

/* ---------- 범용 블록 셸 ----------
   full  : 그리드 2칸 전체 너비 차지
   bar   : 상단 강조 액센트 바
   label/icon/accent : 헤더 라벨 줄
   code  : "// 한 줄 소개" 같은 소문자 코드 주석 라벨 스타일 */
interface BlockProps {
  children: ReactNode;
  label?: string;
  icon?: ReactNode;
  accent?: BlockAccent;
  full?: boolean;
  bar?: boolean;
  code?: boolean;
  className?: string;
}

export function Block({
  children,
  label,
  icon,
  accent = 'accent',
  full,
  bar,
  code,
  className,
}: BlockProps) {
  const color = ACCENT_VAR[accent];
  const cls =
    'block' +
    (full ? ' block--full' : '') +
    (className ? ' ' + className : '');
  return (
    <div className={cls}>
      {bar && (
        <span
          className="block__bar"
          style={{ background: color, boxShadow: '0 0 10px var(--glow)' }}
        />
      )}
      {label && (
        <div className={'block__label' + (code ? ' block__label--code' : '')}>
          {icon && (
            <span className="block__label-ico" style={{ color }}>
              {icon}
            </span>
          )}
          <span>{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- 프리셋 블록 ---------- */

/* 한 줄 소개 — 큰 강조 문구 (전체 너비 + 상단 바) */
export function QuoteBlock({
  label = '// 한 줄 소개',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <Block full bar code accent="cyan" label={label} className="block--lead">
      <p className="block__lead">{children}</p>
    </Block>
  );
}

/* 프로필 — key/value 테이블 (전체 너비) */
export interface ProfileRow {
  k: string;
  v: ReactNode;
}
export function ProfileBlock({
  label = 'PROFILE',
  rows,
}: {
  label?: string;
  rows: ProfileRow[];
}) {
  return (
    <Block full accent="accent" label={label} icon={<UserIcon />}>
      <div className="kv">
        {rows.map((r, i) => (
          <div className="kv__row" key={i}>
            <span className="kv__k">{r.k}</span>
            <span className="kv__v">{r.v}</span>
          </div>
        ))}
      </div>
    </Block>
  );
}

/* 태그 묶음 — 좋아하는 것 / 싫어하는 것 등 (기본 반칸) */
export function TagBlock({
  label,
  accent = 'cyan',
  icon,
  tags,
  full,
}: {
  label: string;
  accent?: BlockAccent;
  icon?: ReactNode;
  tags: string[];
  full?: boolean;
}) {
  return (
    <Block full={full} accent={accent} label={label} icon={icon}>
      <div className="tagrow">
        {tags.map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
      </div>
    </Block>
  );
}

/* 긴 텍스트 본문 (기본 전체 너비) */
export function TextBlock({
  label,
  accent = 'mustard',
  icon,
  children,
  full = true,
}: {
  label?: string;
  accent?: BlockAccent;
  icon?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <Block full={full} accent={accent} label={label} icon={icon}>
      <p className="block__text">{children}</p>
    </Block>
  );
}

/* 빈 블록 — 자리표시 / 추후 채움 (전체 너비, 점선) */
export function EmptyBlock({
  children = '빈 블록 · 원하는 내용을 추가하거나 이 카드를 삭제하세요',
}: {
  children?: ReactNode;
}) {
  return (
    <div className="block block--full block--dashed">
      <span className="block__empty-ico">
        <PlusIcon />
      </span>
      <span className="block__empty">{children}</span>
    </div>
  );
}

/* ─────────── 디자인 시스템 공용 컴포넌트 ─────────── */

/* 표준 카드 컨테이너 — background/border/radius/shadow (.ds-card CSS) */
export function DSCard({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={'ds-card' + (className ? ' ' + className : '')} style={style}>
      {children}
    </div>
  );
}

/* 반응형 그리드 — cols: 2|3|4 (.ds-grid-N CSS) */
export function DSGrid({
  cols,
  children,
  style,
}: {
  cols: 2 | 3 | 4;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={`ds-grid-${cols}`} style={style}>
      {children}
    </div>
  );
}

/* 아이콘 타일 — 링크 카드의 다크 배경 타일 (link-card__tile CSS 재사용) */
export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="link-card__tile">
      <span className="dot" />
      {children}
    </span>
  );
}

/* 디자인 시스템 섹션 헤더 — 번호 + 라벨 + 페이드 라인 */
export function DSSectionHead({ no, label }: { no: string; label: string }) {
  return (
    <div className="ds-section-head">
      <span className="ds-section-head__no">{no}</span>
      <span className="ds-section-head__label">{label}</span>
      <span className="ds-section-head__line" />
    </div>
  );
}

/* 디자인 시스템 카드 레이블 — 모노 소문자 캡션 */
export function DSCardLabel({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={'ds-card-label' + (className ? ' ' + className : '')}
      style={style}
    >
      {children}
    </div>
  );
}
