/**
 * Role hierarchy: corporate_admin > site_admin > manager > operator > viewer
 * Higher roles inherit all permissions of lower roles.
 */

export const ROLES = {
  CORPORATE_ADMIN: 'corporate_admin',
  SITE_ADMIN: 'site_admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  corporate_admin: 50,
  site_admin: 40,
  manager: 30,
  operator: 20,
  viewer: 10,
};

export const ROLE_LABELS: Record<Role, string> = {
  corporate_admin: 'Corporate Admin',
  site_admin: 'Site Admin',
  manager: 'Manager',
  operator: 'Operator',
  viewer: 'Viewer',
};

/** Check if roleA has equal or higher privileges than roleB */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
