'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      router.push('/login?reset=success');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired link. Please request a new reset.');
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
            Set new password
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Enter your new password below
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         text-sm placeholder-gray-400
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200 outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
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
                Resetting...
              </span>
            ) : 'Reset Password'}
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

        <p className="text-center text-[11px] text-gray-300 dark:text-gray-600 mt-8">
          LeanPilot v4 — Manufacturing Intelligence by Centro Studi Grassi
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
