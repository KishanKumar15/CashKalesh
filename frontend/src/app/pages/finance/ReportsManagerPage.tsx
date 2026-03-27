import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../../services/api';
import { buildQueryString, readPrefixedFilters, summarizeSeries, writePrefixedFilters } from '../../viewModels';
import { formatCurrency, getReportQuery, type ReportFilters, type ReportsManagerPageProps } from './common';
import { uiButtonClass, uiChipClass, uiHeroClass, uiInputClass, uiPanelClass, uiStatCardClass } from './ui';

function getConservativeForecast(data: ReportsManagerPageProps['forecastDaily']) {
  return data.map((point, index) => ({
    ...point,
    projectedBalance: Math.round(point.projectedBalance - (index + 1) * 220 - Math.max(0, point.projectedBalance * 0.05)),
  }));
}

function getDangerDates(data: ReportsManagerPageProps['forecastDaily'], threshold: number) {
  return data.filter((point) => point.projectedBalance <= threshold);
}

function getForecastReason(
  point: ReportsManagerPageProps['forecastDaily'][number] | undefined,
  previousPoint: ReportsManagerPageProps['forecastDaily'][number] | undefined,
  recurring: ReportsManagerPageProps['recurring'],
) {
  if (!point) return 'Hover or tap a forecast point to inspect what changes around that day.';
  const drop = previousPoint ? previousPoint.projectedBalance - point.projectedBalance : 0;
  const recurringAroundPoint = recurring.filter((item) => Math.abs(new Date(item.nextRunDate).getTime() - new Date(point.date).getTime()) <= 3 * 24 * 60 * 60 * 1000);

  if (recurringAroundPoint.length > 0) {
    return `This movement lines up with ${recurringAroundPoint.map((item) => item.title).join(', ')} and the current spending run-rate.`;
  }

  if (drop > 0) {
    return `Projected balance drops by ${formatCurrency(drop)} here, likely from recent spend pressure carrying into the next few days.`;
  }

  return 'This point stays comparatively stable with no major forecast pressure visible nearby.';
}

function formatFilterDate(value: string) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return format(parsedDate, 'dd MMM yyyy');
}

export function ReportsManagerPage({
  reports,
  forecastDaily,
  forecastMonth,
  recurring,
  accounts,
  categories,
  setError,
  setToast,
}: ReportsManagerPageProps) {
  const [report, setReport] = useState(reports);
  const [filters, setFilters] = useState<ReportFilters>(() => readPrefixedFilters('report_', { from: '', to: '', accountId: '', categoryId: '', type: '' }));
  const [loading, setLoading] = useState(false);
  const [forecastMode, setForecastMode] = useState<'normal' | 'conservative'>('normal');
  const [selectedForecastIndex, setSelectedForecastIndex] = useState(0);

  useEffect(() => {
    if (!filters.from && !filters.to && !filters.accountId && !filters.categoryId && !filters.type) {
      setReport(reports);
    }
  }, [filters, reports]);

  useEffect(() => {
    writePrefixedFilters('report_', filters);
  }, [filters]);

  async function applyFilters(nextFilters: ReportFilters) {
    setLoading(true);
    setError('');
    try {
      setReport(await api.reports(getReportQuery(nextFilters)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }

  async function download(kind: 'pdf' | 'csv') {
    setLoading(true);
    setError('');
    try {
      const query = getReportQuery(filters);
      if (kind === 'pdf') {
        await api.downloadReportPdf(query);
        setToast('Branded PDF export downloaded.');
      } else {
        await api.downloadReportCsv(query);
        setToast('Branded CSV export downloaded.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to download report.');
    } finally {
      setLoading(false);
    }
  }

  const totalIncome = report.monthlyTrend.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = report.monthlyTrend.reduce((sum, item) => sum + item.expense, 0);
  const netBalance = totalIncome - totalExpense;
  const leadingCategory = report.categoryBreakdown[0];
  const conservativeForecast = useMemo(() => getConservativeForecast(forecastDaily), [forecastDaily]);
  const visibleForecast = forecastMode === 'normal' ? forecastDaily : conservativeForecast;
  const dangerThreshold = 5000;
  const dangerDates = useMemo(() => getDangerDates(visibleForecast, dangerThreshold), [visibleForecast]);
  const selectedPoint = visibleForecast[selectedForecastIndex] ?? visibleForecast[0];
  const previousPoint = selectedForecastIndex > 0 ? visibleForecast[selectedForecastIndex - 1] : undefined;
  const biggestForecastDrop = useMemo(() => {
    if (visibleForecast.length === 0) return { point: undefined, drop: 0 };
    return visibleForecast.reduce(
      (worst, point, index, source) => {
        if (index === 0) return worst;
        const change = source[index - 1]!.projectedBalance - point.projectedBalance;
        return change > worst.drop ? { point, drop: change } : worst;
      },
      { point: visibleForecast[0], drop: 0 },
    );
  }, [visibleForecast]);
  const filterSummary = buildQueryString(getReportQuery(filters)).replace('?', '') || 'Default last 12 months';
  const activeFilterChips = useMemo(
    () =>
      (Object.entries(filters) as Array<[keyof ReportFilters, string]>)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => {
          if (key === 'from') return { key, label: 'From date', value: formatFilterDate(value) };
          if (key === 'to') return { key, label: 'To date', value: formatFilterDate(value) };
          if (key === 'accountId') {
            const accountName = accounts.find((item) => item.id === value)?.name ?? value;
            return { key, label: 'Account', value: accountName };
          }
          if (key === 'categoryId') {
            const categoryName = categories.find((item) => item.id === value)?.name ?? value;
            return { key, label: 'Category', value: categoryName };
          }
          return { key, label: 'Transaction type', value };
        }),
    [accounts, categories, filters],
  );

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Reporting Studio</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Turn raw activity into a story you can act on.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Filtered reports, branded exports, and forecast context stay in one readable surface.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={uiStatCardClass('positive')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Income</span><strong className="mt-2 block text-2xl text-emerald-100">{formatCurrency(totalIncome)}</strong></div>
            <div className={uiStatCardClass('warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Expense</span><strong className="mt-2 block text-2xl text-orange-100">{formatCurrency(totalExpense)}</strong></div>
            <div className={uiStatCardClass(netBalance >= 0 ? 'neutral' : 'warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Net</span><strong className={`mt-2 block text-2xl ${netBalance >= 0 ? 'text-sky-100' : 'text-orange-100'}`}>{formatCurrency(netBalance)}</strong></div>
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Top category</span><strong className="mt-2 block text-2xl text-white">{leadingCategory?.category ?? 'No data'}</strong></div>
          </div>
        </div>
      </section>

      <section className={uiPanelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Report filters</h3>
          <span className="text-sm text-[var(--muted)]">Server-side account, category, type, and date range</span>
        </div>
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">All filters are optional. Leave blank to use the default reporting window.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">From date (optional)<input className={uiInputClass} type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">To date (optional)<input className={uiInputClass} type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Account (optional)<select className={uiInputClass} value={filters.accountId} onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}><option value="">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category (optional)<select className={uiInputClass} value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}><option value="">All categories</option>{categories.filter((item) => !item.isArchived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Transaction type (optional)<select className={uiInputClass} value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="">All types</option><option value="Expense">Expense</option><option value="Income">Income</option><option value="Transfer">Transfer</option></select></label>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.length > 0
              ? activeFilterChips.map((chip) => <span className={uiChipClass} key={chip.key}>{chip.label}: {chip.value}</span>)
              : <span className={uiChipClass}>Default reporting window</span>}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={() => { const cleared = { from: '', to: '', accountId: '', categoryId: '', type: '' }; setFilters(cleared); void applyFilters(cleared); }}>Clear filters</button>
            <button className={uiButtonClass('ghost')} disabled={loading} onClick={() => void download('csv')}>Download CSV</button>
            <button className={uiButtonClass('primary')} disabled={loading} onClick={() => void download('pdf')}>{loading ? 'Working...' : 'Download PDF'}</button>
            <button className={uiButtonClass('primary')} disabled={loading} onClick={() => void applyFilters(filters)}>{loading ? 'Refreshing...' : 'Refresh report'}</button>
          </div>
        </div>
      </section>

      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Forecast Lab</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">See pressure dates before they hit your cash flow.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Switch between normal and conservative projections, inspect danger dates, and review reasons behind dips.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={uiStatCardClass((visibleForecast[visibleForecast.length - 1]?.projectedBalance ?? forecastMonth.projectedEndBalance) >= dangerThreshold ? 'positive' : 'warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">End balance</span><strong className={`mt-2 block text-2xl ${forecastMonth.projectedEndBalance >= dangerThreshold ? 'text-emerald-100' : 'text-orange-100'}`}>{formatCurrency(visibleForecast[visibleForecast.length - 1]?.projectedBalance ?? forecastMonth.projectedEndBalance)}</strong></div>
            <div className={uiStatCardClass('neutral')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Safe to spend</span><strong className="mt-2 block text-2xl text-sky-100">{formatCurrency(forecastMonth.safeToSpend)}</strong></div>
            <div className={uiStatCardClass(dangerDates.length > 0 ? 'warning' : 'positive')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Danger dates</span><strong className={`mt-2 block text-2xl ${dangerDates.length > 0 ? 'text-orange-100' : 'text-emerald-100'}`}>{dangerDates.length}</strong></div>
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Biggest dip</span><strong className="mt-2 block text-2xl text-white">{biggestForecastDrop.drop > 0 ? formatCurrency(biggestForecastDrop.drop) : 'Stable'}</strong></div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex rounded-2xl border border-white/15 bg-white/[0.04] p-1">
              <button
                className={`rounded-xl px-4 py-2 text-sm transition ${forecastMode === 'normal' ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`}
                onClick={() => setForecastMode('normal')}
              >
                Normal
              </button>
              <button
                className={`rounded-xl px-4 py-2 text-sm transition ${forecastMode === 'conservative' ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`}
                onClick={() => setForecastMode('conservative')}
              >
                Conservative
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {forecastMonth.warnings.length > 0
                ? forecastMonth.warnings.map((warning) => <span className={`${uiChipClass} border-orange-300/30 bg-orange-500/20`} key={warning}>{warning}</span>)
                : <span className={uiChipClass}>No immediate forecast warnings.</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Forecast explorer</h3>
            <span className="text-sm text-[var(--muted)]">{forecastMode === 'normal' ? 'Normal projection' : 'Conservative projection'}</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={visibleForecast}
              onMouseMove={(state) => {
                if (typeof state.activeTooltipIndex === 'number') {
                  setSelectedForecastIndex(state.activeTooltipIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd MMM')} />
              <YAxis />
              <Tooltip labelFormatter={(value) => format(new Date(value), 'dd MMM yyyy')} />
              <ReferenceLine y={dangerThreshold} stroke="#F97316" strokeDasharray="4 4" />
              <Area dataKey="projectedBalance" stroke="#4f7dff" fill="rgba(79,125,255,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-3 text-sm text-[var(--muted)]">{summarizeSeries(visibleForecast, `${forecastMode === 'normal' ? 'Normal' : 'Conservative'} daily forecast`)}</p>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Danger zone</h3>
            <span className="text-sm text-[var(--muted)]">Below {formatCurrency(dangerThreshold)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dangerDates.length > 0
              ? dangerDates.slice(0, 6).map((point) => <span className={`${uiChipClass} border-orange-300/30 bg-orange-500/20`} key={point.date}>{format(new Date(point.date), 'dd MMM')}</span>)
              : <span className={`${uiChipClass} border-emerald-300/30 bg-emerald-500/20`}>No danger dates in this view</span>}
          </div>
          <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Confidence</strong><span>{forecastMonth.confidence}</span></div>
            <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Selected day</strong><span>{selectedPoint ? format(new Date(selectedPoint.date), 'dd MMM yyyy') : 'None'}</span></div>
            <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Projected balance</strong><span>{selectedPoint ? formatCurrency(selectedPoint.projectedBalance) : 'No data'}</span></div>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">{getForecastReason(selectedPoint, previousPoint, recurring)}</p>
        </section>

        <section className={`${uiPanelClass} xl:col-span-2`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Report takeaway</h3>
            <span className="text-sm text-[var(--muted)]">{filterSummary}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <strong className="text-base text-[var(--text)]">{netBalance >= 0 ? 'You are operating above break-even in this report window.' : 'Expense is outrunning income in this report window.'}</strong>
              <p className="mt-2 text-sm text-[var(--muted)]">{leadingCategory ? `${leadingCategory.category} is the biggest visible spending category at ${formatCurrency(leadingCategory.amount)}.` : 'Apply a broader filter range to generate category insights.'}</p>
            </div>
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Tracked months</strong><span>{report.monthlyTrend.length}</span></div>
              <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Forecast points</strong><span>{forecastDaily.length}</span></div>
              <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Goal snapshots</strong><span>{report.savingsProgress.length}</span></div>
            </div>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Trend</h3>
            <span className="text-sm text-[var(--muted)]">{filterSummary}</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="income" fill="#10B981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" fill="#F97316" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-3 text-sm text-[var(--muted)]">{summarizeSeries(report.monthlyTrend, 'Monthly report trend')}</p>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Savings rate trend</h3>
            <span className="text-sm text-[var(--muted)]">Income minus expense by month</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={report.savingsRateTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Area dataKey="balance" stroke="#10B981" fill="rgba(16,185,129,0.2)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-3 text-sm text-[var(--muted)]">{summarizeSeries(report.savingsRateTrend, 'Savings rate')}</p>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Balance trend by account</h3>
            <span className="text-sm text-[var(--muted)]">Account-level movement</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={report.accountBalanceTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Area dataKey="balance" stroke="#78d7ff" fill="rgba(120,215,255,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-3 text-sm text-[var(--muted)]">{summarizeSeries(report.accountBalanceTrend, 'Account balance trend')}</p>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Category breakdown</h3>
            <span className="text-sm text-[var(--muted)]">Top categories</span>
          </div>
          <div className="grid gap-2">
            {report.categoryBreakdown.map((item) => (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm" key={item.category}>
                <strong className="text-[var(--text)]">{item.category}</strong>
                <span className="text-[var(--muted)]">{item.amount.toLocaleString()}</span>
              </div>
            ))}
            {report.categoryBreakdown.length === 0 && <p className="text-sm text-[var(--muted)]">No report data for this filter set.</p>}
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Savings goals</h3>
            <span className="text-sm text-[var(--muted)]">Progress snapshot</span>
          </div>
          <div className="grid gap-3">
            {report.savingsProgress.map((item) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" key={item.goal}>
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <strong className="text-[var(--text)]">{item.goal}</strong>
                  <span className="text-[var(--muted)]">{item.currentAmount.toLocaleString()} / {item.targetAmount.toLocaleString()}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-gradient-to-r from-[#6fa5ff] to-[#8f65ff]" style={{ width: `${item.progressPercent}%` }} />
                </div>
              </div>
            ))}
            {report.savingsProgress.length === 0 && <p className="text-sm text-[var(--muted)]">No goal data for these report filters.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
