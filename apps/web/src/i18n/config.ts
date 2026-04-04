export const locales = ['en', 'it', 'sr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  it: 'Italiano',
  sr: 'Srpski',
};

export const localeFlags: Record<Locale, string> = {
  en: 'GB',
  it: 'IT',
  sr: 'RS',
};
