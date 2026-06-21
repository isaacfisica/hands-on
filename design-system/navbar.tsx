'use client';

import { useState } from 'react';
import { AtomIcon, SunIcon, MoonIcon } from './icons';
import { useTheme } from '@/lib/theme-context';

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  // { label: 'YouTube', href: '#' },
  // { label: '스트리밍', href: '#' },
  // { label: 'Discord', href: '#' },
  { label: 'About', href: '/about' },
  { label: 'FAQ', href: '/faq' },

];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { setTheme, isDark } = useTheme();
  const themeLabel = isDark
    ? '검출기 홀 · NIGHT — 클릭하면 라이트'
    : '연구실 벤치 · DAY — 클릭하면 다크';

  return (
    <header className="nav">
      <div className="nav__inner">
        {/* 브랜드 */}
        <a className="nav__brand" href="/" aria-label="이삭 ISAAC — 홈">
          <span className="nav__mark">
            <AtomIcon />
          </span>
          <span className="nav__word">
            이삭 <em>ISAAC</em>
          </span>
        </a>

        {/* 데스크탑 메뉴 */}
        <nav className="nav__menu" aria-label="주요 메뉴">
          {navItems.map((item) => (
            <a className="nav__link" href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={themeLabel}
            title={themeLabel}
            className="toggle"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            <span className="toggle__icon toggle__icon--sun">
              <SunIcon />
            </span>
            <span className="toggle__icon toggle__icon--moon">
              <MoonIcon />
            </span>
            <span className="toggle__knob" />
          </button>
        </nav>

        {/* 모바일 전용 테마 토글 (햄버거 왼쪽) */}
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          aria-label={themeLabel}
          title={themeLabel}
          className="nav__toggle-mobile toggle"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          <span className="toggle__icon toggle__icon--sun">
            <SunIcon />
          </span>
          <span className="toggle__icon toggle__icon--moon">
            <MoonIcon />
          </span>
          <span className="toggle__knob" />
        </button>

        {/* 햄버거 버튼 (좁은 화면) */}
        <button
          type="button"
          className={'nav__burger' + (open ? ' is-open' : '')}
          aria-label="메뉴 열기"
          aria-expanded={open}
          aria-controls="nav-mobile"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* 모바일 드롭다운 */}
      <div
        id="nav-mobile"
        className={'nav__mobile' + (open ? ' is-open' : '')}
      >
        {navItems.map((item) => (
          <a
            className="nav__mlink"
            href={item.href}
            key={item.label}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}
