import type { Section } from './types';
import type { AppIconName } from './components/AppIcon';

export const navItems: { key: Section; label: string; shortLabel: string; icon: AppIconName; tier: 'primary' | 'secondary' }[] = [
  { key: 'dashboard', label: 'Overview', shortLabel: 'Home', icon: 'overview', tier: 'primary' },
  { key: 'accounts', label: 'Accounts', shortLabel: 'Wallets', icon: 'accounts', tier: 'primary' },
  { key: 'transactions', label: 'Operations', shortLabel: 'Ops', icon: 'transactions', tier: 'primary' },
  { key: 'budgets', label: 'Plans', shortLabel: 'Plans', icon: 'budgets', tier: 'primary' },
  { key: 'insights', label: 'Analytics', shortLabel: 'Data', icon: 'insights', tier: 'primary' },
  { key: 'goals', label: 'Goals', shortLabel: 'Goals', icon: 'goals', tier: 'secondary' },
  { key: 'reports', label: 'Forecast', shortLabel: 'Forecast', icon: 'reports', tier: 'secondary' },
  { key: 'recurring', label: 'Recurring', shortLabel: 'Repeats', icon: 'recurring', tier: 'secondary' },
  { key: 'notifications', label: 'Alerts', shortLabel: 'Alerts', icon: 'notifications', tier: 'secondary' },
  { key: 'rules', label: 'Automation', shortLabel: 'Rules', icon: 'rules', tier: 'secondary' },
  { key: 'settings', label: 'Setup', shortLabel: 'Setup', icon: 'settings', tier: 'secondary' },
];

export const palette = ['#2563EB', '#10B981', '#F97316', '#EC4899', '#8B5CF6', '#0EA5E9'];
