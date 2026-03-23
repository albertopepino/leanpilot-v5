/**
 * Lean tool types — added incrementally as tools are built.
 * Phase 1: 5S Audit + Kaizen Board
 */

// ===== 5S AUDIT =====

export type FiveSCategory = 'sort' | 'setInOrder' | 'shine' | 'standardize' | 'sustain' | 'safety';

export interface FiveSQuestion {
  id: string;
  category: FiveSCategory;
  question: string;
  order: number;
}

export interface FiveSScore {
  category: FiveSCategory;
  score: number;       // 0-5
  notes?: string;
  photoUrl?: string;
}

export interface FiveSAudit {
  id: string;
  siteId: string;
  area: string;         // e.g., "Assembly Line 1", "Warehouse Zone B"
  auditorId: string;
  scores: FiveSScore[];
  totalScore: number;   // calculated: sum / max * 100
  status: 'draft' | 'completed';
  createdAt: Date;
  completedAt?: Date;
}

// ===== KAIZEN =====

export type KaizenStatus = 'submitted' | 'under_review' | 'approved' | 'in_progress' | 'completed' | 'rejected';
export type KaizenImpact = 'low' | 'medium' | 'high';

export interface KaizenSuggestion {
  id: string;
  siteId: string;
  submittedById: string;
  title: string;
  problem: string;
  suggestion: string;
  expectedImpact: KaizenImpact;
  area: string;
  status: KaizenStatus;
  reviewedById?: string;
  reviewNotes?: string;
  implementedAt?: Date;
  createdAt: Date;
}
