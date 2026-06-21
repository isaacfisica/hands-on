'use client';

import { SunIcon, MoonIcon } from '@/components/icons';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  label?: string;
}

export function ThemeToggle({ isDark, onToggle, label }: ThemeToggleProps) {
  const ariaLabel = label ?? (isDark ? '다크 → 라이트' : '라이트 → 다크');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="toggle"
      onClick={onToggle}
    >
      <span className="toggle__icon toggle__icon--sun">
        <SunIcon />
      </span>
      <span className="toggle__icon toggle__icon--moon">
        <MoonIcon />
      </span>
      <span className="toggle__knob" />
    </button>
  );
}
