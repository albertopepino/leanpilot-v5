/** Role values stored as strings in SQLite, enum in PostgreSQL */
export type Role = 'corporate_admin' | 'site_admin' | 'manager' | 'operator' | 'viewer';
export const ROLES: Role[] = ['corporate_admin', 'site_admin', 'manager', 'operator', 'viewer'];

export type FiveSCategory = 'sort' | 'set_in_order' | 'shine' | 'standardize' | 'sustain' | 'safety';
export const FIVE_S_CATEGORIES: FiveSCategory[] = ['sort', 'set_in_order', 'shine', 'standardize', 'sustain', 'safety'];

export type KaizenStatus = 'submitted' | 'under_review' | 'approved' | 'in_progress' | 'completed' | 'rejected';
export const KAIZEN_STATUSES: KaizenStatus[] = ['submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected'];

export type KaizenImpact = 'low' | 'medium' | 'high';
export const KAIZEN_IMPACTS: KaizenImpact[] = ['low', 'medium', 'high'];
