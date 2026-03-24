'use client';

import { Factory, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface WelcomeBannerProps {
  firstName: string;
  siteName: string;
  summary: string[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function WelcomeBanner({ firstName, siteName, summary }: WelcomeBannerProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-violet-600
                    rounded-2xl p-8 text-white relative overflow-hidden
                    shadow-lg shadow-blue-500/20">
      {/* Background pattern — subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Decorative gradient orb */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Factory className="w-5 h-5 text-blue-200" />
            <span className="text-sm font-medium text-blue-200">{siteName}</span>
          </div>
          <h1 className="text-2xl font-bold mt-2">
            {getGreeting()}, {firstName} 👋
          </h1>
          {summary.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {summary.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-sm bg-white/15
                             backdrop-blur-sm rounded-full px-3 py-1 text-white/90"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/gemba"
          className="hidden md:flex items-center gap-2 bg-white/15 backdrop-blur-sm
                     rounded-xl px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-white/25 transition-colors"
        >
          Start Gemba Walk
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
