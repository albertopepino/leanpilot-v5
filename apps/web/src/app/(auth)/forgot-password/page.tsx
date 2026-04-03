'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
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
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reset your password
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Enter your email and we will send you a reset link
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check your email for a reset link. If you do not see it, check your spam folder.
            </div>
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
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
                  Sending...
                </span>
              ) : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        )}

        <p className="text-center text-[11px] text-gray-300 dark:text-gray-600 mt-8">
          LeanPilot v4 — Manufacturing Intelligence by Centro Studi Grassi
        </p>
      </div>
    </div>
  );
}
