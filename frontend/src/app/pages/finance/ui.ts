export const uiPanelClass = 'workspace-panel rounded-3xl p-5 md:p-6';
export const uiHeroClass = 'workspace-hero rounded-3xl p-5 md:p-6';
export const uiInputClass = 'workspace-input rounded-xl p-3 text-[var(--text)]';
export const uiChipClass = 'workspace-chip rounded-full px-3 py-1.5 text-xs';
export const uiEntityCardClass = 'workspace-entity-card rounded-2xl p-4';

export function uiStatCardClass(tone: 'base' | 'positive' | 'warning' | 'neutral') {
  return `workspace-stat-card tone-${tone} rounded-2xl p-4`;
}

export function uiButtonClass(kind: 'primary' | 'ghost') {
  if (kind === 'primary') {
    return 'workspace-button workspace-button-primary rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-60';
  }

  return 'workspace-button workspace-button-ghost rounded-xl px-4 py-2.5 text-sm transition';
}
