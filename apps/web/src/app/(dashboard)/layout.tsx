'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import {
  Factory, LayoutDashboard, Users, Building2, ClipboardCheck,
  Lightbulb, Settings, LogOut, Menu, X, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'viewer' },
  { href: '/corporate', label: 'Corporate', icon: Building2, minRole: 'corporate_admin' },
  { href: '/admin/users', label: 'Users', icon: Users, minRole: 'site_admin' },
  { href: '/tools/five-s', label: '5S Audit', icon: ClipboardCheck, minRole: 'operator' },
  { href: '/tools/kaizen', label: 'Kaizen Board', icon: Lightbulb, minRole: 'operator' },
  { href: '/settings', label: 'Settings', icon: Settings, minRole: 'viewer' },
];

const ROLE_LEVEL: Record<string, number> = {
  corporate_admin: 50,
  site_admin: 40,
  manager: 30,
  operator: 20,
  viewer: 10,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = auth.getUser();
    if (!u) {
      router.push('/login');
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) return null;

  const userLevel = ROLE_LEVEL[user.role] || 0;
  const visibleNav = NAV_ITEMS.filter(item => userLevel >= ROLE_LEVEL[item.minRole]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5 text-brand-600" />
          <span className="font-semibold text-gray-900 dark:text-white">LeanPilot</span>
        </div>
        <div className="w-6" />
      </header>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-200
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Factory className="w-6 h-6 text-brand-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">LeanPilot</span>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Site indicator */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Site</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
            {user.siteName || 'All Sites'}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user.role?.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={() => auth.logout()}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
