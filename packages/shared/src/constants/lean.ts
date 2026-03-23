/**
 * Lean tool registry — each tool is a module that can be enabled per site.
 * Tools are added incrementally. Only Phase 1 tools are active initially.
 */

export interface LeanToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;          // Lucide icon name
  phase: 1 | 2 | 3;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'workplace' | 'flow' | 'quality' | 'improvement' | 'planning';
}

export const LEAN_TOOLS: LeanToolDefinition[] = [
  // Phase 1 — MVP
  {
    id: 'five-s',
    name: '5S / 6S Audit',
    description: 'Workplace organization audit: Sort, Set in Order, Shine, Standardize, Sustain (+Safety)',
    icon: 'ClipboardCheck',
    phase: 1,
    difficulty: 'beginner',
    category: 'workplace',
  },
  {
    id: 'kaizen',
    name: 'Kaizen Board',
    description: 'Continuous improvement suggestions: submit, review, implement, verify',
    icon: 'Lightbulb',
    phase: 1,
    difficulty: 'beginner',
    category: 'improvement',
  },

  // Phase 2 — Core Lean
  {
    id: 'gemba',
    name: 'Gemba Walk',
    description: 'Structured shop floor walks with observations, photos, and action items',
    icon: 'Footprints',
    phase: 2,
    difficulty: 'beginner',
    category: 'workplace',
  },
  {
    id: 'oee',
    name: 'OEE Calculator',
    description: 'Overall Equipment Effectiveness: Availability × Performance × Quality',
    icon: 'Gauge',
    phase: 2,
    difficulty: 'intermediate',
    category: 'flow',
  },
  {
    id: 'andon',
    name: 'Andon Board',
    description: 'Real-time production status display with escalation alerts',
    icon: 'AlertTriangle',
    phase: 2,
    difficulty: 'beginner',
    category: 'flow',
  },
  {
    id: 'a3',
    name: 'A3 Problem Solving',
    description: 'Structured problem solving on a single A3 sheet: background, analysis, plan, follow-up',
    icon: 'FileText',
    phase: 2,
    difficulty: 'intermediate',
    category: 'improvement',
  },

  // Phase 3 — Advanced
  {
    id: 'vsm',
    name: 'Value Stream Map',
    description: 'Map material and information flow to identify waste and design future state',
    icon: 'GitBranch',
    phase: 3,
    difficulty: 'advanced',
    category: 'flow',
  },
  {
    id: 'smed',
    name: 'SMED',
    description: 'Single-Minute Exchange of Dies: reduce changeover times systematically',
    icon: 'Timer',
    phase: 3,
    difficulty: 'advanced',
    category: 'flow',
  },
  {
    id: 'tpm',
    name: 'TPM',
    description: 'Total Productive Maintenance: autonomous maintenance, planned maintenance, training',
    icon: 'Wrench',
    phase: 3,
    difficulty: 'advanced',
    category: 'quality',
  },
  {
    id: 'fmea',
    name: 'FMEA',
    description: 'Failure Mode and Effects Analysis: risk assessment with severity, occurrence, detection',
    icon: 'Shield',
    phase: 3,
    difficulty: 'advanced',
    category: 'quality',
  },
];

export function getToolsByPhase(phase: 1 | 2 | 3): LeanToolDefinition[] {
  return LEAN_TOOLS.filter(t => t.phase <= phase);
}

export function getToolById(id: string): LeanToolDefinition | undefined {
  return LEAN_TOOLS.find(t => t.id === id);
}
