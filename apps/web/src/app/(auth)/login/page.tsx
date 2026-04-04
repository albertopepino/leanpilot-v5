'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { auth } from '@/lib/api';
import { getLoginRedirect } from '@/lib/permissions';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { BrandLogo } from '@/components/brand/BrandLogo';

const LEAN_QUOTES = [
  { text: 'The most dangerous kind of waste is the waste we do not recognize.', author: 'Shigeo Shingo' },
  { text: 'Where there is no standard, there can be no kaizen.', author: 'Taiichi Ohno' },
  { text: 'All we are doing is looking at the timeline, from the moment the customer gives us an order to the point when we collect the cash.', author: 'Taiichi Ohno' },
  { text: 'The key to the Toyota Way is not any of the individual elements. What is important is having all the elements together as a system.', author: 'Jeffrey Liker' },
  { text: 'Continuous improvement is better than delayed perfection.', author: 'Mark Twain' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
  { text: 'Without data, you are just another person with an opinion.', author: 'W. Edwards Deming' },
  { text: 'It is not enough to do your best; you must know what to do, and then do your best.', author: 'W. Edwards Deming' },
  { text: 'The Toyota style is not to create results by working hard. It is a system that says there is no limit to people\'s creativity.', author: 'Taiichi Ohno' },
  { text: 'Start by doing what is necessary; then do what is possible; and suddenly you are doing the impossible.', author: 'Francis of Assisi' },
];

function TwoFactorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRefs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const next = digits.slice();
    next[index] = char;
    onChange(next.join('').trim());
    if (char && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs[focusIdx].current?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={inputRefs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
          className="w-12 h-14 text-center text-xl font-semibold rounded-xl border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-amber-400/70 focus:border-transparent
                     transition-all duration-200 outline-none"
        />
      ))}
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const resetSuccess = searchParams.get('reset') === 'success';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [quoteFade, setQuoteFade] = useState(true);

  // 2FA state
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Rotate quotes
  useEffect(() => {
    setQuoteIndex(Math.floor(Math.random() * LEAN_QUOTES.length));
    const interval = setInterval(() => {
      setQuoteFade(false);
      setTimeout(() => {
        setQuoteIndex(prev => (prev + 1) % LEAN_QUOTES.length);
        setQuoteFade(true);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await auth.login(email, password);
      if (result && 'requiresTwoFactor' in result && result.requiresTwoFactor) {
        setTempToken(result.tempToken);
        setTwoFactorStep(true);
      } else {
        const dest = getLoginRedirect(result);
        router.push(dest);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await auth.verifyTwoFactor(tempToken, otpCode);
      const dest = getLoginRedirect(user);
      router.push(dest);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const quote = LEAN_QUOTES[quoteIndex];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden brand-panel">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative orbs */}
        <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo + Tagline */}
          <div>
            <BrandLogo size="lg" theme="dark" subtitle="Factory Flow Control" />
          </div>

          {/* Quote */}
          <div className="max-w-lg">
            <div className={`transition-opacity duration-500 ${quoteFade ? 'opacity-100' : 'opacity-0'}`}>
              <svg className="w-10 h-10 text-blue-400/30 mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
              </svg>
              <blockquote className="text-xl lg:text-2xl font-light text-white/90 leading-relaxed mb-6">
                {quote.text}
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-px h-8 bg-blue-400/30" />
                <cite className="text-sm font-medium text-blue-300/80 not-italic">
                  {quote.author}
                </cite>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/20">
              Built by Lean Black Belts for the shop floor
            </p>
            <div className="flex items-center gap-4 text-white/15 text-[10px] uppercase tracking-widest font-medium">
              <span>TPM</span>
              <span className="w-1 h-1 rounded-full bg-white/15" />
              <span>OEE</span>
              <span className="w-1 h-1 rounded-full bg-white/15" />
              <span>5S</span>
              <span className="w-1 h-1 rounded-full bg-white/15" />
              <span>Kaizen</span>
              <span className="w-1 h-1 rounded-full bg-white/15" />
              <span>8D</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden text-center mb-10">
            <BrandLogo size="md" subtitle="Factory Flow Control" className="justify-center" />
          </div>

          {twoFactorStep ? (
            /* 2FA Verification Screen */
            <>
              <div className="mb-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Two-Factor Authentication
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
                {error && (
                  <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <TwoFactorInput value={otpCode} onChange={setOtpCode} />

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-amber-500
                             hover:from-blue-700 hover:via-blue-800 hover:to-amber-500
                             disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-700
                             text-white font-semibold rounded-xl text-sm
                             shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30
                             disabled:shadow-none
                             transition-all duration-200
                             focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Verifying...
                    </span>
                  ) : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={() => { setTwoFactorStep(false); setOtpCode(''); setTempToken(''); setError(''); }}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Back to login
                </button>
              </form>
            </>
          ) : (
          <>
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('welcomeBack')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              {t('signInToFactory')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {resetSuccess && (
              <div className="p-3.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('resetSuccess')}
              </div>
            )}
            {error && (
              <div className="p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           text-sm placeholder-gray-400
                           focus:ring-2 focus:ring-amber-400/70 focus:border-transparent
                           transition-all duration-200 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('password')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder={t('enterPassword')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           text-sm placeholder-gray-400
                           focus:ring-2 focus:ring-amber-400/70 focus:border-transparent
                           transition-all duration-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-blue-700 to-amber-500
                         hover:from-blue-700 hover:via-blue-800 hover:to-amber-500
                         disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-700
                         text-white font-semibold rounded-xl text-sm
                         shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30
                         disabled:shadow-none
                         transition-all duration-200
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {t('signingIn')}
                </span>
              ) : t('login')}
            </button>
          </form>

          {/* Mobile quote */}
          <div className="lg:hidden mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center leading-relaxed">
              &ldquo;{quote.text}&rdquo;
              <span className="block mt-1 not-italic font-medium text-gray-500 dark:text-gray-400">
                — {quote.author}
              </span>
            </p>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 space-y-3">
            <div className="flex justify-center">
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px]">
              <Link href="/privacy" className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <Link href="/terms" className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Terms of Service
              </Link>
            </div>
            <p className="text-[11px] text-gray-300 dark:text-gray-600">
              LeanPilot v5.7 — Manufacturing Intelligence by Centro Studi Grassi
            </p>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
