import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppBundle, Section } from '../types';
import { palette } from '../constants';
import { summarizeSeries } from '../viewModels';
import { uiHeroClass, uiPanelClass, uiStatCardClass } from './finance/ui';

const FORECAST_DANGER_THRESHOLD = 5000;

function formatCompactAmount(value: number) {
  return value.toLocaleString('en-IN');
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'warning' | 'neutral' }) {
  const toneStyles = tone === 'positive' ? uiStatCardClass('positive') : tone === 'warning' ? uiStatCardClass('warning') : uiStatCardClass('neutral');

  return (
    <article className={toneStyles}>
      <p className="text-xs uppercase tracking-[0.18em] text-white/60">{label}</p>
      <strong className="mt-2 block text-2xl font-semibold tracking-tight">{formatCompactAmount(value)}</strong>
    </article>
  );
}

function BudgetSignalCard({ budget }: { budget: AppBundle['dashboard']['budgets'][number] }) {
  const state = budget.healthPercent >= 100 ? 'danger' : budget.healthPercent >= 80 ? 'warning' : 'safe';
  const label = state === 'danger' ? 'Overspent' : state === 'warning' ? 'At risk' : 'On track';
  const toneClass = state === 'danger'
    ? 'border-rose-400/25 bg-rose-500/10'
    : state === 'warning'
      ? 'border-amber-400/25 bg-amber-500/10'
      : 'border-emerald-400/25 bg-emerald-500/10';

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--text)]">{budget.categoryName}</h4>
        <span className="text-xs text-white/70">{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-[#6fa5ff] to-[#8f65ff]"
          style={{ width: `${Math.min(100, budget.healthPercent)}%` }}
        />
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
        <div className="flex items-center justify-between">
          <span>Spent</span>
          <strong className="text-[var(--text)]">{formatCompactAmount(budget.spent)}</strong>
        </div>
        <div className="flex items-center justify-between">
          <span>Budget</span>
          <strong className="text-[var(--text)]">{formatCompactAmount(budget.amount)}</strong>
        </div>
      </div>
    </article>
  );
}

function getForecastCause(bundle: AppBundle, index: number) {
  const point = bundle.forecastDaily[index];
  const previous = index > 0 ? bundle.forecastDaily[index - 1] : undefined;

  if (!point) {
    return 'Hover the forecast to inspect where pressure is likely to build next.';
  }

  const drop = previous ? previous.projectedBalance - point.projectedBalance : 0;
  const linkedRecurring = bundle.recurring.filter((item) => Math.abs(new Date(item.nextRunDate).getTime() - new Date(point.date).getTime()) <= 3 * 24 * 60 * 60 * 1000);

  if (linkedRecurring.length > 0) {
    return `Pressure likely comes from ${linkedRecurring.map((item) => item.title).join(', ')} around this date.`;
  }

  if (drop > 0) {
    return `Projected balance dips by ${drop.toLocaleString('en-IN')} compared with the prior day.`;
  }

  return 'This part of the forecast stays comparatively stable.';
}

export function DashboardCommandCenter({ bundle, onNavigate }: { bundle: AppBundle; onNavigate: (section: Section) => void; }) {
  const [activeForecastIndex, setActiveForecastIndex] = useState(Math.max(0, bundle.forecastDaily.length - 1));
  const totalBalance = bundle.accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const overspent = bundle.dashboard.budgets.filter((budget) => budget.healthPercent >= 100).length;
  const recommendation = overspent > 0
    ? `${overspent} budget ${overspent === 1 ? 'needs' : 'need'} attention before the month compounds.`
    : bundle.dashboard.forecast.warnings[0] ?? 'Everything looks stable enough to move with confidence.';
  const activeForecastPoint = bundle.forecastDaily[activeForecastIndex];
  const dangerDates = useMemo(() => bundle.forecastDaily.filter((point) => point.projectedBalance <= FORECAST_DANGER_THRESHOLD), [bundle.forecastDaily]);

  return (
    <div className="dashboard-sample-board grid gap-6 pb-24 xl:pb-6">
      <header className={`${uiPanelClass} dashboard-greeting-surface`}>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Dashboard</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] md:text-4xl">Welcome back</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">Here is your money snapshot with balance momentum, category pressure, recent operations, and near-term forecast guidance.</p>
      </header>

      <section className="dashboard-stage-grid grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <article className={`${uiHeroClass} dashboard-balance-surface`}>
          <p className="text-xs uppercase tracking-[0.2em] text-white/65">Total Balance</p>
          <h3 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">{formatCompactAmount(totalBalance)}</h3>
          <p className="mt-3 text-sm leading-7 text-white/70">{recommendation}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatCard label="Expenses" value={bundle.dashboard.expense} tone="warning" />
            <StatCard label="Income" value={bundle.dashboard.income} tone="positive" />
            <StatCard label="Safe to spend" value={bundle.dashboard.forecast.safeToSpend} tone="neutral" />
            <StatCard label="Health score" value={bundle.dashboard.healthScore.score} tone="neutral" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button className="rounded-xl bg-gradient-to-r from-[#4f7dff] to-[#3d6dff] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>Quick Add</button>
            <button className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/[0.08]" onClick={() => onNavigate('transactions')}>Transactions</button>
            <button className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/[0.08]" onClick={() => onNavigate('budgets')}>Budgets</button>
          </div>
        </article>

        <section className={`${uiPanelClass} dashboard-expense-surface`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Total Expenses</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[var(--muted)]">This month</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={bundle.dashboard.incomeExpenseTrend}>
              <defs>
                <linearGradient id="overviewExpenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8d65ff" stopOpacity={0.45} /><stop offset="100%" stopColor="#8d65ff" stopOpacity={0.04} /></linearGradient>
                <linearGradient id="overviewIncomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5f1ff" stopOpacity={0.24} /><stop offset="100%" stopColor="#f5f1ff" stopOpacity={0.02} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Area dataKey="expense" stroke="#8d65ff" fill="url(#overviewExpenseFill)" strokeWidth={2.6} />
              <Area dataKey="income" stroke="#dcd5ff" fill="url(#overviewIncomeFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{summarizeSeries(bundle.dashboard.incomeExpenseTrend, 'Expense compared with income')}</p>
        </section>
      </section>

      <section className="dashboard-core-grid grid gap-6 lg:grid-cols-2">
        <article className={`${uiPanelClass} dashboard-category-surface`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Expenses by Category</h3>
            <span className="text-xs text-[var(--muted)]">Current mix</span>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="grid gap-3">
              {bundle.dashboard.spendingByCategory.slice(0, 6).map((item, index) => (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5" key={item.category}>
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                    <strong className="text-sm font-medium text-[var(--text)]">{item.category}</strong>
                  </div>
                  <span className="text-sm text-[var(--muted)]">{formatCompactAmount(item.amount)}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bundle.dashboard.spendingByCategory} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={92}>
                  {bundle.dashboard.spendingByCategory.map((item, index) => <Cell key={item.category} fill={palette[index % palette.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${uiPanelClass} dashboard-operations-surface`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Recent Transactions</h3>
            <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:bg-white/[0.06]" onClick={() => onNavigate('transactions')}>See all</button>
          </div>
          <div className="dashboard-operations-header hidden grid-cols-[80px_1.2fr_1fr_1fr] gap-3 border-b border-white/10 pb-2 text-xs uppercase tracking-[0.12em] text-[var(--muted)] md:grid">
            <span>Date</span>
            <span>Merchant</span>
            <span>Category</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="dashboard-operations-list mt-1 grid">
            {bundle.dashboard.recentTransactions.slice(0, 6).map((item) => (
              <div className="dashboard-operations-row grid gap-1.5 border-b border-white/8 py-3 md:grid-cols-[80px_1.2fr_1fr_1fr] md:gap-3" key={item.id}>
                <span className="text-sm text-[var(--muted)]">{format(new Date(item.transactionDate), 'dd MMM')}</span>
                <strong className="text-sm text-[var(--text)]">{item.merchant}</strong>
                <span className="text-sm text-[var(--muted)]">{item.categoryName ?? 'Transfer'}</span>
                <span className={`text-sm text-right ${item.type === 'Income' ? 'text-emerald-300' : item.type === 'Expense' ? 'text-orange-300' : 'text-sky-300'}`}>
                  {item.type === 'Income' ? '+' : item.type === 'Expense' ? '-' : ''}
                  {formatCompactAmount(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-forecast-grid grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className={`${uiPanelClass} dashboard-forecast-surface`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Forecast and Safe to Spend</h3>
            <span className="text-xs text-[var(--muted)]">{activeForecastPoint ? format(new Date(activeForecastPoint.date), 'dd MMM') : 'Month end'}</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={bundle.forecastDaily}
              onMouseMove={(state) => {
                if (typeof state.activeTooltipIndex === 'number') {
                  setActiveForecastIndex(state.activeTooltipIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
              <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd MMM')} />
              <YAxis />
              <Tooltip labelFormatter={(value) => format(new Date(value), 'dd MMM yyyy')} />
              <ReferenceArea y1={0} y2={FORECAST_DANGER_THRESHOLD} fill="rgba(249, 115, 22, 0.08)" />
              <Area dataKey="projectedBalance" stroke="#5ea4ff" fill="rgba(94,164,255,0.18)" strokeWidth={2.4} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Hovered balance</span>
                <strong className="text-[var(--text)]">{activeForecastPoint ? activeForecastPoint.projectedBalance.toLocaleString('en-IN') : 'No data'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Danger dates</span>
                <strong className="text-[var(--text)]">{dangerDates.length > 0 ? `${dangerDates.length} below threshold` : 'No low-balance dates'}</strong>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{getForecastCause(bundle, activeForecastIndex)}</p>
          </div>
        </article>

        <div className="grid gap-6">
          <article className={`${uiPanelClass} dashboard-recommendation-surface`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text)]">Top Recommendation</h3>
              <span className="text-xs text-[var(--muted)]">{bundle.dashboard.forecast.confidence} confidence</span>
            </div>
            <p className="text-base font-semibold leading-8 text-[var(--text)]">{recommendation}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">CASHKALESH analyzes recurring schedules, category pressure, and balance movement so your next move is obvious.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {bundle.dashboard.forecast.warnings.length > 0
                ? bundle.dashboard.forecast.warnings.map((warning) => (
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white/90" key={warning}>{warning}</span>
                ))
                : <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white/90">The next few days look stable.</span>}
            </div>
          </article>

          <article className={`${uiPanelClass} dashboard-budget-health-surface`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text)]">Budget Health</h3>
              <span className="text-xs text-[var(--muted)]">{bundle.dashboard.budgets.length} active budgets</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {bundle.dashboard.budgets.slice(0, 4).map((budget) => <BudgetSignalCard key={budget.id} budget={budget} />)}
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-support-grid grid gap-6 xl:grid-cols-2">
        <article className={`${uiPanelClass} dashboard-insight-surface`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--text)]">Insight Stories</h3>
            <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[var(--muted)] transition hover:bg-white/[0.06]" onClick={() => onNavigate('insights')}>View all</button>
          </div>
          <div className="grid gap-3">
            {bundle.dashboard.insights.slice(0, 4).map((item) => (
              <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-4" key={item.title}>
                <strong className="text-sm text-[var(--text)]">{item.title}</strong>
                <p className="mt-1 text-sm leading-7 text-[var(--muted)]">{item.message}</p>
              </article>
            ))}
          </div>
        </article>

        <article className={`${uiPanelClass} dashboard-actions-surface`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--text)]">Goal and Forecast Actions</h3>
            <span className="text-xs text-[var(--muted)]">Next steps</span>
          </div>
          <p className="text-sm leading-7 text-[var(--muted)]">{overspent > 0 ? 'This month needs sharper category control before upcoming recurring charges hit.' : 'Your plan looks steady. Keep momentum with a small goal contribution this week.'}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/[0.08]" onClick={() => onNavigate('goals')}>Open goals</button>
            <button className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/[0.08]" onClick={() => onNavigate('reports')}>Forecast lab</button>
          </div>
        </article>
      </section>
    </div>
  );
}
