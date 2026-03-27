import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import type { DashboardResponse, GoalDto, InsightCardDto, TransactionDto } from '../../services/api';
import { getGoalProgressPercent } from '../viewModels';

function shouldReduceMotion() {
  return document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function MetricCard({ label, value, tone, suffix = '' }: { label: string; value: number; tone: 'positive' | 'warning' | 'neutral'; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(shouldReduceMotion() ? value : 0);

  useEffect(() => {
    if (shouldReduceMotion()) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const duration = 620;
    const initialValue = displayValue;
    const delta = value - initialValue;

    const tick = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(initialValue + delta * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{Math.round(displayValue).toLocaleString()}{suffix}</strong></div>;
}

export function TransactionRow({ transaction }: { transaction: TransactionDto }) {
  return (
    <div className="transaction-row">
      <div>
        <strong>{transaction.merchant}</strong>
        <span>{transaction.accountName} | {transaction.categoryName ?? 'Transfer'}</span>
      </div>
      <div className={transaction.type === 'Income' ? 'amount positive' : transaction.type === 'Transfer' ? 'amount neutral' : 'amount warning'}>
        {transaction.type === 'Income' ? '+' : transaction.type === 'Expense' ? '-' : ''}
        {transaction.amount.toLocaleString()}
      </div>
    </div>
  );
}

export function GoalCard({ goal }: { goal: GoalDto }) {
  const percent = getGoalProgressPercent(goal.currentAmount, goal.targetAmount);

  return (
    <div className="hero-card goal-card" style={{ borderColor: goal.color }}>
      <h3>{goal.name}</h3>
      <p>{goal.targetDate ? format(new Date(goal.targetDate), 'dd MMM yyyy') : 'No target date'}</p>
      <strong>{goal.currentAmount.toLocaleString()} / {goal.targetAmount.toLocaleString()}</strong>
      <div className="progress-bar large"><span style={{ width: `${percent}%`, background: goal.color }} /></div>
      <div className="goal-meta">
        <span className="pill">{goal.status}</span>
        {goal.isShared && <span className="pill accent">Shared via {goal.linkedAccountName ?? 'account'}</span>}
      </div>
      <p className="muted">Owner: {goal.ownerDisplayName}</p>
      <div className="pill-list">
        {goal.participants.map((participant) => <span className="pill" key={participant.userId}>{participant.displayName} | {participant.role}</span>)}
      </div>
    </div>
  );
}

export function InsightRow({ insight }: { insight: InsightCardDto }) {
  return <div className={`card insight-card ${insight.tone}`}><strong>{insight.title}</strong><p>{insight.message}</p></div>;
}

export function BudgetCard({ budget }: { budget: DashboardResponse['budgets'][number] }) {
  return (
    <div className="card list-card">
      <div className="section-heading"><h3>{budget.categoryName}</h3><span>{budget.healthPercent}% used</span></div>
      <div className="progress-bar large"><span style={{ width: `${Math.min(100, budget.healthPercent)}%` }} /></div>
      <div className="simple-row"><strong>Spent</strong><span>{budget.spent.toLocaleString()}</span></div>
      <div className="simple-row"><strong>Budget</strong><span>{budget.amount.toLocaleString()}</span></div>
    </div>
  );
}
