'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { getLoginRedirect } from '@/lib/permissions';

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [quoteFade, setQuoteFade] = useState(true);

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
      const user = await auth.login(email, password);
      const dest = getLoginRedirect(user);
      router.push(dest);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quote = LEAN_QUOTES[quoteIndex];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative orbs */}
        <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo + Tagline */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <svg viewBox="0 0 32 32" className="w-7 h-7">
                  <path d="M8 22V10l4 4 4-4 4 4 4-4v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <circle cx="8" cy="22" r="1.5" fill="#fff"/>
                  <circle cx="24" cy="22" r="1.5" fill="#fff"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">LeanPilot</h1>
                <p className="text-xs text-blue-300/70 font-medium tracking-wider uppercase">Manufacturing Intelligence</p>
              </div>
            </div>
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
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <svg viewBox="0 0 32 32" className="w-6 h-6">
                  <path d="M8 22V10l4 4 4-4 4 4 4-4v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <circle cx="8" cy="22" r="1.5" fill="#fff"/>
                  <circle cx="24" cy="22" r="1.5" fill="#fff"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">LeanPilot</span>
            </div>
            <p className="text-sm text-gray-400">Manufacturing Intelligence Platform</p>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
              Sign in to your factory dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           text-sm placeholder-gray-400
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all duration-200 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                           text-sm placeholder-gray-400
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all duration-200 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-violet-600
                         hover:from-blue-700 hover:to-violet-700
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
                  Signing in...
                </span>
              ) : 'Sign In'}
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
          <p className="text-center text-[11px] text-gray-300 dark:text-gray-600 mt-8">
            LeanPilot v4 — Manufacturing Intelligence by Centro Studi Grassi
          </p>
        </div>
      </div>
    </div>
  );
}
