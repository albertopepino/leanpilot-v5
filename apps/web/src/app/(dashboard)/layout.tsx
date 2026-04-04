'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, api } from '@/lib/api';
import {
  Factory, LayoutDashboard, Users, Building2, ClipboardCheck,
  Lightbulb, Settings, LogOut, Menu, X, Bell,
  Eye, MonitorSmartphone, Radio, ShieldCheck, Gauge, FileText,
  Wrench, ShieldAlert, Search, PackageCheck, ArrowLeftRight,
  CheckSquare, Users2, FileBarChart, GraduationCap, Timer, Database,
} from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { hasPermission, isSystemAdmin, type UserWithPermissions } from '@/lib/permissions';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: any;
  group?: string;
  minLevel?: string;
  systemRole?: string;
  external?: boolean;
  children?: NavItem[];
  iconGradient?: string;
  section?: string;
  /** Maps this nav item to a site tool config slug for enable/disable filtering */
  toolSlug?: string;
};

const NAV_ITEMS: NavItem[] = [
  // ── Core ────────────────────────────────────────────────────
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, toolSlug: 'dashboard', iconGradient: 'from-blue-600 to-indigo-600' },
  { href: '/shift-handover', label: 'Shift Handover', icon: ArrowLeftRight, group: 'shift_management', minLevel: 'view', toolSlug: 'shift-handover', iconGradient: 'from-teal-500 to-cyan-500' },
  { href: '/orders', label: 'Orders', icon: PackageCheck, group: 'production', minLevel: 'view', toolSlug: 'orders', iconGradient: 'from-blue-500 to-indigo-500' },
  { href: '/corporate', label: 'Corporate', icon: Building2, systemRole: 'corporate_admin', iconGradient: 'from-slate-600 to-slate-500' },
  // ── Lean Tools ──────────────────────────────────────────────
  { section: 'Lean Tools', href: '/gemba', label: 'Gemba Walk', icon: Eye, group: 'continuous_improvement', minLevel: 'manage', toolSlug: 'gemba', iconGradient: 'from-cyan-600 to-blue-500' },
  { href: '/tools/five-s', label: '5S Audit', icon: ClipboardCheck, group: 'continuous_improvement', minLevel: 'participate', toolSlug: 'five-s', iconGradient: 'from-orange-500 to-amber-500' },
  { href: '/tools/kaizen', label: 'Kaizen Board', icon: Lightbulb, group: 'continuous_improvement', minLevel: 'participate', toolSlug: 'kaizen', iconGradient: 'from-amber-500 to-orange-500' },
  { href: '/equipment', label: 'Equipment', icon: Wrench, group: 'maintenance', minLevel: 'view', toolSlug: 'equipment', iconGradient: 'from-slate-600 to-slate-500' },
  {
    href: '/quality', label: 'Quality', icon: ShieldCheck, group: 'quality', minLevel: 'view', toolSlug: 'quality', iconGradient: 'from-emerald-600 to-teal-500',
    children: [
      { href: '/quality/documents', label: 'Documents', icon: FileText, group: 'quality', minLevel: 'view' },
      { href: '/quality/root-cause', label: 'Root Cause', icon: Search, group: 'problem_solving', minLevel: 'view' },
      { href: '/quality/capa', label: 'CAPA Register', icon: ClipboardCheck, group: 'quality', minLevel: 'view' },
    ],
  },
  // ── Safety ──────────────────────────────────────────────────
  { section: 'Safety', href: '/safety', label: 'Safety', icon: ShieldAlert, group: 'safety', minLevel: 'view', toolSlug: 'safety', iconGradient: 'from-red-500 to-orange-500' },
  // ── System ──────────────────────────────────────────────────
  { section: 'System', href: '/admin/users', label: 'Users', icon: Users, group: 'people', minLevel: 'manage', iconGradient: 'from-gray-500 to-gray-400' },
  { href: '/admin/roles', label: 'Roles', icon: ShieldCheck, group: 'people', minLevel: 'manage', iconGradient: 'from-gray-500 to-gray-400' },
  { href: '/admin/tools', label: 'Tools', icon: Settings, group: 'people', minLevel: 'manage', iconGradient: 'from-gray-500 to-gray-400' },
  { href: '/admin/escalation', label: 'Escalation', icon: Bell, group: 'people', minLevel: 'manage', iconGradient: 'from-amber-500 to-orange-500' },
  { href: '/admin/reason-codes', label: 'Reason Codes', icon: Settings, group: 'people', minLevel: 'manage', iconGradient: 'from-gray-500 to-gray-400' },
  { href: '/admin/erp', label: 'ERP Integration', icon: Database, group: 'people', minLevel: 'manage', iconGradient: 'from-indigo-500 to-blue-500' },
  { href: '/settings', label: 'Settings', icon: Settings, iconGradient: 'from-gray-500 to-gray-400' },
  // ── External (Shop Floor) ───────────────────────────────────
  { href: '/shopfloor', label: 'Shop Floor', icon: MonitorSmartphone, group: 'production', minLevel: 'participate', external: true, iconGradient: 'from-indigo-500 to-blue-500' },
  { href: '/andon', label: 'Andon Board', icon: Radio, group: 'production', minLevel: 'view', external: true, iconGradient: 'from-red-500 to-orange-500' },
];

function isNavItemVisible(item: NavItem, user: UserWithPermissions, enabledTools?: Set<string>): boolean {
  if (item.systemRole) return user.role === item.systemRole;
  // If the item has a toolSlug and we have tool config data, check if tool is enabled
  if (item.toolSlug && enabledTools && !enabledTools.has(item.toolSlug)) {
    return false;
  }
  if (!item.group) return true;
  return hasPermission(user, item.group as any, (item.minLevel || 'view') as any);
}

// Map nav item href to translation key
const NAV_LABEL_KEYS: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/shift-handover': 'shiftHandover',
  '/orders': 'orders',
  '/corporate': 'corporate',
  '/gemba': 'gembaWalk',
  '/tools/five-s': 'fiveS',
  '/tools/kaizen': 'kaizen',
  '/equipment': 'equipment',
  '/quality': 'quality',
  '/quality/documents': 'documents',
  '/quality/root-cause': 'rootCause',
  '/quality/capa': 'capaRegister',
  '/safety': 'safety',
  '/admin/users': 'users',
  '/admin/roles': 'roles',
  '/admin/tools': 'tools',
  '/admin/escalation': 'escalation',
  '/admin/reason-codes': 'reasonCodes',
  '/settings': 'settings',
  '/shopfloor': 'shopFloor',
  '/andon': 'andonBoard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const [user, setUser] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [enabledTools, setEnabledTools] = useState<Set<string> | undefined>(undefined);

  useEffect(() => {
    const u = auth.getUser();
    if (!u) {
      router.push('/login');
    } else {
      setUser(u);
      // Fetch site tool configs to filter sidebar
      api.get<Array<{ toolSlug: string; isEnabled: boolean }>>('/site-config/tools')
        .then(configs => {
          if (Array.isArray(configs)) {
            setEnabledTools(new Set(configs.filter(c => c.isEnabled).map(c => c.toolSlug)));
          }
        })
        .catch(() => {
          // If fetch fails, show all tools (graceful degradation)
        });
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

  const visibleNav = NAV_ITEMS.filter(item => isNavItemVisible(item, user, enabledTools));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
        <BrandLogo size="sm" subtitle="Ops" />
        <NotificationBell />
      </header>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64
          bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl
          border-r border-gray-200/30 dark:border-gray-700/30
          shadow-2xl shadow-gray-300/20 dark:shadow-black/30
          transform transition-transform duration-300 ease-out
          lg:translate-x-0 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.7) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }} />
        {/* Sidebar header */}
        <div className="relative flex items-center justify-between px-5 py-5 border-b border-gray-100/80 dark:border-gray-800/80">
          <BrandLogo size="sm" subtitle="Operations" />
          <button
            className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Site indicator */}
        <div className="relative px-5 py-3 border-b border-gray-100/80 dark:border-gray-800/80">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Site</p>
          <div className="mt-0.5">
            {user.siteLogo ? (
              <img src={user.siteLogo} alt={user.siteName || 'Site'} className="h-8 object-contain" />
            ) : (
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                {user.siteName || 'All Sites'}
              </p>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item, idx) => {
            const Icon = item.icon;
            const children = item.children?.filter(c => isNavItemVisible(c, user, enabledTools));
            const hasChildren = children && children.length > 0;

            const childActive = hasChildren && children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'));
            const active = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : !childActive && (pathname === item.href || pathname.startsWith(item.href + '/'));
            const expanded = active || childActive;

            const isExternal = item.external;

            // Section header with gradient separator
            const sectionHeader = item.section ? (
              <div className={idx > 0 ? 'mt-5' : ''}>
                <div className="h-px mx-3 mb-3 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600 mb-2 px-3">
                  {item.section}
                </p>
              </div>
            ) : null;

            // Icon element — gradient bg when active, muted otherwise
            const iconEl = (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110
                ${active && item.iconGradient
                  ? `bg-gradient-to-br ${item.iconGradient} shadow-sm`
                  : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'}`}>
                <Icon className={`w-3.5 h-3.5 transition-transform duration-200 ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
              </div>
            );

            const linkClass = `
              group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200
              ${active
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-700/50 border-l-2 border-blue-500 dark:border-blue-400 translate-x-0.5'
                : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-gray-200 hover:translate-x-1 border-l-2 border-transparent'
              }
            `;

            const translatedLabel = NAV_LABEL_KEYS[item.href] ? tNav(NAV_LABEL_KEYS[item.href]) : item.label;

            const navLink = isExternal ? (
              <a key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={linkClass}>
                {iconEl}
                {translatedLabel}
              </a>
            ) : (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={linkClass}>
                {iconEl}
                {translatedLabel}
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
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-all duration-200
                            ${childIsActive
                              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-900/20'
                              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:translate-x-0.5'}`}>
                          <ChildIcon className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200" />
                          {NAV_LABEL_KEYS[child.href] ? tNav(NAV_LABEL_KEYS[child.href]) : child.label}
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

        {/* Gradient separator before user footer */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />

        {/* Language switcher */}
        <div className="px-4 py-2">
          <LanguageSwitcher />
        </div>

        {/* User footer -- pinned to bottom */}
        <div className="shrink-0 px-4 py-4">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-amber-500
                            flex items-center justify-center shadow-lg shadow-blue-500/25 ring-2 ring-white/50 dark:ring-gray-800/50">
              <span className="text-xs font-bold text-white">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {user.customRoleName || user.role?.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => auth.logout()}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg
                       text-xs font-medium text-gray-400 hover:text-red-600
                       hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            {tAuth('logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
