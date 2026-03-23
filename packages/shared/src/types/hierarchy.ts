/**
 * Corporate → Site → User hierarchy
 * This is the core multi-tenant model for LeanPilot.
 */

export interface Corporate {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  createdAt: Date;
  sites: Site[];
}

export interface Site {
  id: string;
  corporateId: string;
  name: string;
  slug: string;
  location?: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SiteWithStats extends Site {
  userCount: number;
  activeTools: string[];
  lastActivity?: Date;
}
