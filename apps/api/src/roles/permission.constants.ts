export const FEATURE_GROUPS = [
  'production',
  'shift_management',
  'continuous_improvement',
  'quality',
  'problem_solving',
  'safety',
  'maintenance',
  'people',
] as const;

export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

export const PERMISSION_LEVELS = ['none', 'view', 'participate', 'manage'] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const LEVEL_HIERARCHY: Record<string, number> = {
  none: 0,
  view: 10,
  participate: 20,
  manage: 30,
};

// System roles that bypass permission checks
export const SYSTEM_ADMIN_ROLES = ['corporate_admin', 'site_admin'];

// Compliance floor: safety.participate is forced on for all roles
export const COMPLIANCE_FLOOR: Record<string, string> = {
  safety: 'participate',
};
