'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import {
  Factory, LayoutDashboard, Users, Building2, ClipboardCheck,
  Lightbulb, Settings, LogOut, Menu, X,
  Eye, MonitorSmartphone, Radio, ShieldCheck, Gauge, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: any;
  minRole: string;
  external?: boolean;
  children?: NavItem[];
  iconGradient?: string;
  section?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'viewer', iconGradient: 'from-blue-600 to-indigo-600' },
  { href: '/corporate', label: 'Corporate', icon: Building2, minRole: 'corporate_admin', iconGradient: 'from-slate-600 to-slate-500' },
  { section: 'Lean Tools', href: '/gemba', label: 'Gemba Walk', icon: Eye, minRole: 'manager', iconGradient: 'from-cyan-600 to-blue-500' },
  { href: '/tools/five-s', label: '5S Audit', icon: ClipboardCheck, minRole: 'operator', iconGradient: 'from-orange-500 to-amber-500' },
  { href: '/tools/kaizen', label: 'Kaizen Board', icon: Lightbulb, minRole: 'operator', iconGradient: 'from-violet-600 to-purple-500' },
  {
    href: '/quality', label: 'Quality', icon: ShieldCheck, minRole: 'operator', iconGradient: 'from-emerald-600 to-teal-500',
    children: [
      { href: '/quality/documents', label: 'Documents', icon: FileText, minRole: 'viewer' },
    ],
  },
  { section: 'Analytics', href: '/dashboard/oee', label: 'OEE', icon: Gauge, minRole: 'viewer', iconGradient: 'from-blue-500 to-cyan-500' },
  { section: 'System', href: '/admin/users', label: 'Users', icon: Users, minRole: 'site_admin', iconGradient: 'from-gray-500 to-gray-400' },
  { href: '/settings', label: 'Settings', icon: Settings, minRole: 'viewer', iconGradient: 'from-gray-500 to-gray-400' },
  { href: '/shopfloor', label: 'Shop Floor', icon: MonitorSmartphone, minRole: 'operator', external: true, iconGradient: 'from-indigo-500 to-blue-500' },
  { href: '/andon', label: 'Andon Board', icon: Radio, minRole: 'viewer', external: true, iconGradient: 'from-red-500 to-orange-500' },
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
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = auth.getUser();
    if (!u) {
      router.push('/login');
    } else {
      setUser(u);
    }
    setHydrated(true);
  }, [router]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

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
          fixed top-0 left-0 z-50 h-full w-64
          bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl
          border-r border-gray-200/50 dark:border-gray-700/50
          shadow-xl shadow-gray-200/20 dark:shadow-none
          transform transition-transform duration-300 ease-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600
                            flex items-center justify-center shadow-md shadow-blue-500/25">
              <Factory className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">LeanPilot</span>
          </div>
          <button
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Site indicator */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Site</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate mt-0.5">
            {user.siteName || 'All Sites'}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item, idx) => {
            const Icon = item.icon;
            const children = item.children?.filter(c => userLevel >= ROLE_LEVEL[c.minRole]);
            const hasChildren = children && children.length > 0;

            const childActive = hasChildren && children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'));
            const active = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : !childActive && (pathname === item.href || pathname.startsWith(item.href + '/'));
            const expanded = active || childActive;

            const isExternal = item.external;

            // Section header
            const sectionHeader = item.section ? (
              <p className={`text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600
                            ${idx > 0 ? 'mt-5' : ''} mb-2 px-3`}>
                {item.section}
              </p>
            ) : null;

            // Icon element — gradient bg when active, muted otherwise
            const iconEl = (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200
                ${active && item.iconGradient
                  ? `bg-gradient-to-br ${item.iconGradient} shadow-sm`
                  : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'}`}>
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
              </div>
            );

            const linkClass = `
              group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200
              ${active
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-700/50'
                : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `;

            const navLink = isExternal ? (
              <a key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={linkClass}>
                {iconEl}
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={linkClass}>
                {iconEl}
                {item.label}
              </Link>
            );

            const content = !hasChildren ? navLink : (
              <div key={item.href}>
                {navLink}
                {expanded && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-gray-200/60 dark:border-gray-700/60 pl-3">
                    {children.map(child => {
                      const ChildIcon = child.icon;
                      const childIsActive = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <Link key={child.href} href={child.href} onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-all
                            ${childIsActive
                              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-900/20'
                              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );

            return sectionHeader ? (
              <div key={item.href}>
                {sectionHeader}
                {content}
              </div>
            ) : content;
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500
                            flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-white">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {user.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={() => auth.logout()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500
                         hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
