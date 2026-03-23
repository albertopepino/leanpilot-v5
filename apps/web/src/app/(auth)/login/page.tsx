'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(body.message || 'Login failed');
      }

      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'corporate_admin') {
        router.push('/corporate');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', background: '#2563eb', borderRadius: '16px', marginBottom: '16px'
          }}>
            <span style={{ fontSize: '28px' }}>🏭</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>LeanPilot</h1>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>Lean Manufacturing Made Simple</p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb', padding: '32px'
        }}>
          {error && (
            <div style={{
              marginBottom: '16px', padding: '12px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Email
            </label>
            <input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoFocus placeholder="admin@leanpilot.me"
              style={{
                width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
              Password
            </label>
            <input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required placeholder="Enter your password"
              style={{
                width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px 16px', background: loading ? '#93c5fd' : '#2563eb',
            color: '#fff', fontWeight: 500, borderRadius: '8px', border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px'
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '24px' }}>
          LeanPilot v4.0 — leanpilot.me
        </p>
      </div>
    </div>
  );
}
