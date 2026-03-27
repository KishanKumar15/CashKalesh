import { useMemo, useState } from 'react';
import type { DashboardResponse, InsightCardDto } from '../../../services/api';
import { uiButtonClass, uiChipClass, uiHeroClass, uiPanelClass } from '../finance/ui';
import { createRuleDraftFromInsight, getInsightGroup, getInsightStorageKey } from './common';

function readStoredInsights(kind: 'saved' | 'dismissed') {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(getInsightStorageKey(kind)) ?? '[]') as string[]);
  } catch {
    return new Set<string>();
  }
}

function persistStoredInsights(kind: 'saved' | 'dismissed', values: Set<string>) {
  localStorage.setItem(getInsightStorageKey(kind), JSON.stringify([...values]));
}

export function InsightsStudioPage({
  dashboard,
  insights,
  onCreateRule,
  setToast,
}: {
  dashboard: DashboardResponse;
  insights: InsightCardDto[];
  onCreateRule: (insight: InsightCardDto) => void;
  setToast: (value: string) => void;
}) {
  const [expandedInsight, setExpandedInsight] = useState('');
  const [savedInsights, setSavedInsights] = useState(() => readStoredInsights('saved'));
  const [dismissedInsights, setDismissedInsights] = useState(() => readStoredInsights('dismissed'));
  const [activeGroup, setActiveGroup] = useState('All');

  const visibleInsights = useMemo(() => {
    const filtered = insights.filter((item) => !dismissedInsights.has(item.title));
    if (activeGroup === 'All') return filtered;
    return filtered.filter((item) => getInsightGroup(item) === activeGroup);
  }, [activeGroup, dismissedInsights, insights]);

  const warningCount = visibleInsights.filter((item) => item.tone === 'warning').length;
  const positiveCount = visibleInsights.filter((item) => item.tone === 'positive').length;
  const groups = ['All', ...new Set(insights.map((item) => getInsightGroup(item)))];

  function toggleSaved(title: string) {
    const next = new Set(savedInsights);
    if (next.has(title)) {
      next.delete(title);
      setToast('Insight removed from saved items.');
    } else {
      next.add(title);
      setToast('Insight saved for later.');
    }
    setSavedInsights(next);
    persistStoredInsights('saved', next);
  }

  function dismissInsight(title: string) {
    const next = new Set(dismissedInsights);
    next.add(title);
    setDismissedInsights(next);
    persistStoredInsights('dismissed', next);
    setToast('Insight dismissed from this workspace.');
  }

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Insights Studio</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">See what changed, why it matters, and where to act next.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">CASHKALESH turns health scoring, forecast warnings, and behavior shifts into readable decisions.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Health score</span><strong className="mt-2 block text-2xl text-white">{dashboard.healthScore.score}/100</strong></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Signals</span><strong className="mt-2 block text-2xl text-sky-100">{visibleInsights.length}</strong></div>
            <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Warnings</span><strong className="mt-2 block text-2xl text-orange-100">{warningCount}</strong></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Positive trends</span><strong className="mt-2 block text-2xl text-emerald-100">{positiveCount}</strong></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Health score factors</h3>
            <span className="text-sm text-[var(--muted)]">{dashboard.healthScore.score}/100</span>
          </div>
          <div className="grid gap-3">
            {dashboard.healthScore.factors.map((factor) => (
              <div key={factor.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text)]">{factor.name}</h4>
                  <span className="text-xs text-[var(--muted)]">{factor.score}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">{factor.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Recommended next moves</h3>
            <span className="text-sm text-[var(--muted)]">{dashboard.healthScore.suggestions.length} actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dashboard.healthScore.suggestions.map((item) => <span key={item} className={`${uiChipClass} border-sky-300/30 bg-sky-500/20`}>{item}</span>)}
          </div>
          <div className="mt-4 inline-flex flex-wrap rounded-2xl border border-white/15 bg-white/[0.04] p-1">
            {groups.map((group) => (
              <button
                key={group}
                className={`rounded-xl px-4 py-2 text-sm transition ${activeGroup === group ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`}
                onClick={() => setActiveGroup(group)}
              >
                {group}
              </button>
            ))}
          </div>
        </section>

        <section className={`${uiPanelClass} xl:col-span-2`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Insight feed</h3>
            <span className="text-sm text-[var(--muted)]">{savedInsights.size} saved</span>
          </div>
          <div className="grid gap-3">
            {visibleInsights.map((item) => {
              const isExpanded = expandedInsight === item.title;
              const group = getInsightGroup(item);
              const draftPreview = createRuleDraftFromInsight(item);
              return (
                <article key={item.title} className={`rounded-2xl border p-4 ${item.tone === 'warning' ? 'border-orange-300/30 bg-orange-500/10' : 'border-emerald-300/30 bg-emerald-500/10'}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">{item.title}</h4>
                    <span className="text-xs text-[var(--muted)]">{group}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{item.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={uiChipClass}>{group}</span>
                    {savedInsights.has(item.title) && <span className={`${uiChipClass} border-sky-300/30 bg-sky-500/20`}>Saved</span>}
                  </div>
                  {isExpanded && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-[var(--muted)]">
                      <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Why this matters</strong><span>{item.tone === 'warning' ? 'Potential risk signal' : 'Behavior trend worth reinforcing'}</span></div>
                      <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Suggested automation</strong><span>{`${draftPreview.actions[0].type} -> ${draftPreview.actions[0].value}`}</span></div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    <button className={uiButtonClass('ghost')} onClick={() => setExpandedInsight(isExpanded ? '' : item.title)}>{isExpanded ? 'Collapse' : 'Expand detail'}</button>
                    <button className={uiButtonClass('ghost')} onClick={() => toggleSaved(item.title)}>{savedInsights.has(item.title) ? 'Unsave' : 'Save insight'}</button>
                    <button className={uiButtonClass('ghost')} onClick={() => dismissInsight(item.title)}>Dismiss</button>
                    <button className={uiButtonClass('primary')} onClick={() => onCreateRule(item)}>Create rule</button>
                  </div>
                </article>
              );
            })}
            {visibleInsights.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <strong className="text-[var(--text)]">No insights in this view.</strong>
                <p className="mt-1 text-sm text-[var(--muted)]">Try another group or refresh the workspace to pull the latest analysis.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
