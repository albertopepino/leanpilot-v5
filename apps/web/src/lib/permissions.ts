// ── Permission Matrix System ──────────────────────────────────────

export const FEATURE_GROUPS = [
  'production', 'shift_management', 'continuous_improvement',
  'quality', 'problem_solving', 'safety', 'maintenance', 'people',
] as const;

export type FeatureGroup = typeof FEATURE_GROUPS[number];
export type PermissionLevel = 'none' | 'view' | 'participate' | 'manage';

export type PermissionMap = Partial<Record<FeatureGroup, PermissionLevel>>;

const LEVEL_VALUE: Record<string, number> = {
  none: 0, view: 10, participate: 20, manage: 30,
};

// System roles that bypass all permission checks
const SYSTEM_ADMIN_ROLES = ['corporate_admin', 'site_admin'];

export interface UserWithPermissions {
  id: string;
  role: string;
  permissions?: PermissionMap;
  [key: string]: any;
}

/** Check if user has at least the required permission level for a feature group */
export function hasPermission(
  user: UserWithPermissions | null,
  group: FeatureGroup,
  level: PermissionLevel,
): boolean {
  if (!user) return false;

  // System admins bypass all checks
  if (SYSTEM_ADMIN_ROLES.includes(user.role)) return true;

  // Compliance floor: everyone can report safety
  if (group === 'safety' && level === 'participate') return true;

  const userLevel = user.permissions?.[group] || 'none';
  return (LEVEL_VALUE[userLevel] || 0) >= (LEVEL_VALUE[level] || 0);
}

/** Check if user is a system admin */
export function isSystemAdmin(user: UserWithPermissions | null): boolean {
  return !!user && SYSTEM_ADMIN_ROLES.includes(user.role);
}

/** Get the highest permission level the user has across all groups */
export function getHighestPermission(user: UserWithPermissions | null): PermissionLevel {
  if (!user || !user.permissions) return 'none';
  if (isSystemAdmin(user)) return 'manage';

  let highest = 0;
  for (const level of Object.values(user.permissions)) {
    highest = Math.max(highest, LEVEL_VALUE[level || 'none'] || 0);
  }
  for (const [val, name] of [[30, 'manage'], [20, 'participate'], [10, 'view'], [0, 'none']] as const) {
    if (highest >= val) return name as PermissionLevel;
  }
  return 'none';
}

/** Determine where to redirect user after login */
export function getLoginRedirect(user: UserWithPermissions): string {
  if (user.role === 'corporate_admin') return '/corporate';
  if (user.role === 'site_admin') return '/dashboard';

  // Check if user only has production permissions
  const perms = user.permissions || {};
  const nonProductionGroups = FEATURE_GROUPS.filter(g => g !== 'production' && g !== 'safety');
  const hasOnlyProduction = nonProductionGroups.every(g => {
    const level = perms[g] || 'none';
    return level === 'none';
  });

  if (hasOnlyProduction && (LEVEL_VALUE[perms.production || 'none'] || 0) >= LEVEL_VALUE.participate) {
    return '/shopfloor';
  }

  return '/dashboard';
}

// ── Feature Group Labels ──────────────────────────────────────────

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, { name: string; description: string }> = {
  production: { name: 'Production', description: 'Shop Floor, Andon Board, Orders' },
  shift_management: { name: 'Shift Management', description: 'Shift Handover, Tier Meetings' },
  continuous_improvement: { name: 'Continuous Improvement', description: '5S Audit, Kaizen, Gemba Walk, Actions' },
  quality: { name: 'Quality', description: 'Inspections, NCR, SPC, Documents' },
  problem_solving: { name: 'Problem Solving', description: 'Root Cause, A3, SMED, 8D' },
  safety: { name: 'Safety', description: 'Incidents, Investigation' },
  maintenance: { name: 'Maintenance', description: 'Plans, Logs, CILT, Equipment' },
  people: { name: 'People', description: 'Skills Matrix, Users, Roles, Settings' },
};

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, { name: string; description: string }> = {
  none: { name: 'None', description: 'No access' },
  view: { name: 'View', description: 'Read-only access' },
  participate: { name: 'Participate', description: 'Create, submit, execute' },
  manage: { name: 'Manage', description: 'Approve, close, configure' },
};
