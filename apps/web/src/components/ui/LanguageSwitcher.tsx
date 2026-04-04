'use client';

import { useState, useRef, useEffect } from 'react';
import { locales, localeNames, type Locale } from '@/i18n/config';

const flagEmoji: Record<Locale, string> = {
  en: '\uD83C\uDDEC\uD83C\uDDE7',
  it: '\uD83C\uDDEE\uD83C\uDDF9',
  sr: '\uD83C\uDDF7\uD83C\uDDF8',
};

function getCurrentLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return (match?.[1] as Locale) || 'en';
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `locale=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Locale>('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getCurrentLocale());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(locale: Locale) {
    if (locale === current) {
      setOpen(false);
      return;
    }
    setLocaleCookie(locale);
    localStorage.setItem('locale', locale);
    setOpen(false);
    window.location.reload();
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                   text-gray-600 dark:text-gray-400
                   hover:text-gray-900 dark:hover:text-gray-200
                   hover:bg-gray-100 dark:hover:bg-gray-800
                   rounded-lg transition-colors"
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-sm leading-none">{flagEmoji[current]}</span>
        <span>{localeNames[current]}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute bottom-full mb-1 left-0 z-50 min-w-[140px]
                     bg-white dark:bg-gray-900
                     border border-gray-200 dark:border-gray-700
                     rounded-lg shadow-lg py-1
                     animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {locales.map((locale) => (
            <li key={locale}>
              <button
                type="button"
                role="option"
                aria-selected={locale === current}
                onClick={() => handleSelect(locale)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs
                           hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                           ${locale === current
                             ? 'text-blue-600 dark:text-blue-400 font-medium'
                             : 'text-gray-700 dark:text-gray-300'
                           }`}
              >
                <span className="text-sm leading-none">{flagEmoji[locale]}</span>
                <span>{localeNames[locale]}</span>
                {locale === current && (
                  <svg className="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
