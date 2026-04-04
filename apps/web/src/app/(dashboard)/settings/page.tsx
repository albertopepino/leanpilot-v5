'use client';

import { useState, useRef, useEffect } from 'react';
import { auth, api } from '@/lib/api';

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
          className="w-11 h-13 text-center text-lg font-semibold rounded-xl border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-all duration-200 outline-none"
        />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const user = auth.getUser();

  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'disabling'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Check current 2FA status on mount
  useEffect(() => {
    // We read from localStorage user object — the backend stores twoFactorEnabled on the user
    // For a more reliable check, we could add a /me endpoint, but let's use what we have
    // We'll update user in localStorage after enable/disable
    const u = auth.getUser();
    setTwoFaEnabled(u?.twoFactorEnabled ?? false);
  }, []);

  const handleSetup = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await api.post<{ secret: string; qrCodeUrl: string }>('/auth/2fa/setup');
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setSetupStep('qr');
    } catch (err: any) {
      setError(err.message || 'Failed to set up 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/2fa/enable', { token: otpCode });
      setTwoFaEnabled(true);
      setSetupStep('idle');
      setOtpCode('');
      setQrCodeUrl('');
      setSecret('');
      setSuccess('Two-factor authentication has been enabled.');
      // Update user in localStorage
      const u = auth.getUser();
      if (u) {
        u.twoFactorEnabled = true;
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { token: otpCode });
      setTwoFaEnabled(false);
      setSetupStep('idle');
      setOtpCode('');
      setSuccess('Two-factor authentication has been disabled.');
      const u = auth.getUser();
      if (u) {
        u.twoFactorEnabled = false;
        localStorage.setItem('user', JSON.stringify(u));
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      <div className="space-y-6 max-w-lg">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Name</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Email</span>
              <span className="text-gray-900 dark:text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Role</span>
              <span className="text-gray-900 dark:text-white capitalize">
                {user?.role?.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Site</span>
              <span className="text-gray-900 dark:text-white">{user?.siteName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Organization</span>
              <span className="text-gray-900 dark:text-white">{user?.corporateName}</span>
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Two-Factor Authentication
            </h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              twoFaEnabled
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {twoFaEnabled ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                  Enabled
                </>
              ) : 'Disabled'}
            </span>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add an extra layer of security to your account by requiring a verification code from your authenticator app when signing in.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
              {success}
            </div>
          )}

          {setupStep === 'idle' && !twoFaEnabled && (
            <button
              onClick={handleSetup}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600
                         text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          )}

          {setupStep === 'idle' && twoFaEnabled && (
            <button
              onClick={() => { setSetupStep('disabling'); setError(''); setSuccess(''); setOtpCode(''); }}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Disable 2FA
            </button>
          )}

          {setupStep === 'qr' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium mb-2">1. Scan this QR code with your authenticator app:</p>
                <div className="flex justify-center p-4 bg-white rounded-xl border border-gray-200 dark:border-gray-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300">
                <p className="font-medium mb-1">Or enter this key manually:</p>
                <code className="block p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-mono break-all text-gray-800 dark:text-gray-200 select-all">
                  {secret}
                </code>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  2. Enter the 6-digit verification code:
                </p>
                <OtpInput value={otpCode} onChange={setOtpCode} />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleEnable}
                  disabled={loading || otpCode.length !== 6}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600
                             text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button
                  onClick={() => { setSetupStep('idle'); setOtpCode(''); setError(''); }}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300
                             text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {setupStep === 'disabling' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Enter your authenticator code to confirm disabling 2FA:
              </p>
              <OtpInput value={otpCode} onChange={setOtpCode} />
              <div className="flex gap-3">
                <button
                  onClick={handleDisable}
                  disabled={loading || otpCode.length !== 6}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600
                             text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {loading ? 'Disabling...' : 'Confirm Disable'}
                </button>
                <button
                  onClick={() => { setSetupStep('idle'); setOtpCode(''); setError(''); }}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300
                             text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
