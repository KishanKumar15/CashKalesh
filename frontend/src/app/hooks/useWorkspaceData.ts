import { useEffect, useState } from 'react';
import {
  api,
  toUserFacingError,
  type AccountMemberDto,
  type AppBrandingResponse,
  type DashboardResponse,
  type ForecastDailyPoint,
  type GoalDto,
  type NotificationDto,
  type RecurringItemDto,
  type ReportResponse,
  type RuleDto,
  type TransactionDto,
} from '../../services/api';
import type { AppBundle, InviteFormState, RequestEditState, Section } from '../types';
import { validateEditRequestMessage, validateInvitationEmail, validateInvitationToken } from '../viewModels';

const DEFAULT_SECTION_STORAGE_KEY = 'cashkalesh_default_section';
const LAST_SECTION_STORAGE_KEY = 'cashkalesh_last_section';

function readRequiredResult<T>(result: PromiseSettledResult<T>, fallbackMessage: string) {
  if (result.status === 'fulfilled') return result.value;
  throw result.reason instanceof Error ? result.reason : new Error(fallbackMessage);
}

function readOptionalResult<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

const DEFAULT_BRANDING: AppBrandingResponse = {
  appName: 'CashKalesh',
  currencyCode: 'INR',
  locale: 'en-IN',
  notificationMode: 'both',
  deploymentTarget: 'local',
  pdfExportStyle: 'standard',
};

const DEFAULT_DASHBOARD: DashboardResponse = {
  income: 0,
  expense: 0,
  net: 0,
  budgets: [],
  spendingByCategory: [],
  incomeExpenseTrend: [],
  recentTransactions: [],
  upcomingRecurring: [],
  goals: [],
  forecast: { projectedEndBalance: 0, safeToSpend: 0, confidence: 'low', warnings: [] },
  healthScore: { score: 0, factors: [], suggestions: [] },
  insights: [],
};

const DEFAULT_REPORTS: ReportResponse = {
  monthlyTrend: [],
  categoryBreakdown: [],
  accountBalanceTrend: [],
  savingsProgress: [],
  savingsRateTrend: [],
};

function withDefaultInviteForms(accounts: AppBundle['accounts'], current: InviteFormState) {
  return Object.fromEntries(accounts.map((account) => [account.id, current[account.id] ?? { email: '', role: 'Viewer' }])) as InviteFormState;
}

function withDefaultEditRequestForms(accounts: AppBundle['accounts'], current: RequestEditState) {
  return Object.fromEntries(accounts.map((account) => [account.id, current[account.id] ?? 'Please upgrade my access to editor so I can help manage this account.'])) as RequestEditState;
}

export function useWorkspaceData({ token, setLoading, setError, setToast }: { token: string | null; setLoading: (value: boolean) => void; setError: (value: string) => void; setToast: (value: string) => void; }) {
  const [section, setSection] = useState<Section>(() => {
    const querySection = new URLSearchParams(window.location.search).get('section') as Section | null;
    return querySection
      ?? (localStorage.getItem(LAST_SECTION_STORAGE_KEY) as Section | null)
      ?? (localStorage.getItem(DEFAULT_SECTION_STORAGE_KEY) as Section | null)
      ?? 'dashboard';
  });
  const [bundle, setBundle] = useState<AppBundle | null>(null);
  const [inviteForms, setInviteForms] = useState<InviteFormState>({});
  const [requestEditForms, setRequestEditForms] = useState<RequestEditState>({});
  const [acceptInviteToken, setAcceptInviteToken] = useState('');

  async function refreshData() {
    setLoading(true);
    setError('');
    try {
      const [brandingResult, dashboardResult, accountsResult, categoriesResult, transactionsResult, goalsResult, recurringResult, notificationsResult, reportsResult, forecastDailyResult, insightsResult, rulesResult] = await Promise.allSettled([
        api.appInfo(),
        api.dashboard(),
        api.accounts(),
        api.categories(),
        api.transactions({ pageSize: 200 }),
        api.goals(),
        api.recurring(),
        api.notifications(),
        api.reports(),
        api.forecastDaily(),
        api.insights(),
        api.rules(),
      ]);

      const essentialResults = [accountsResult, categoriesResult, transactionsResult];
      if (essentialResults.every((result) => result.status === 'rejected')) {
        throw readRequiredResult(accountsResult, 'We could not load your workspace right now.');
      }

      const branding = readOptionalResult(brandingResult, DEFAULT_BRANDING);
      const dashboard = readOptionalResult(dashboardResult, DEFAULT_DASHBOARD);
      const accounts = readOptionalResult(accountsResult, [] as AppBundle['accounts']);
      const categories = readOptionalResult(categoriesResult, [] as AppBundle['categories']);
      const transactions = readOptionalResult(transactionsResult, [] as TransactionDto[]);
      const goals = readOptionalResult(goalsResult, [] as GoalDto[]);
      const recurring = readOptionalResult(recurringResult, [] as RecurringItemDto[]);
      const reports = readOptionalResult(reportsResult, DEFAULT_REPORTS);
      const forecastDaily = readOptionalResult(forecastDailyResult, [] as ForecastDailyPoint[]);
      const notifications = readOptionalResult(notificationsResult, [] as NotificationDto[]);
      const insights = readOptionalResult(insightsResult, dashboard.insights);
      const rules = readOptionalResult(rulesResult, [] as RuleDto[]);

      const memberEntries = await Promise.allSettled(accounts.map(async (account) => [account.id, await api.accountMembers(account.id)] as const));
      const accountMembers = Object.fromEntries(memberEntries.flatMap((entry) => entry.status === 'fulfilled' ? [entry.value] : [])) as Record<string, AccountMemberDto[]>;

      setBundle({ branding, dashboard, accounts, accountMembers, categories, transactions, goals, recurring, notifications, reports, forecastDaily, insights, rules });
      setInviteForms((current) => withDefaultInviteForms(accounts, current));
      setRequestEditForms((current) => withDefaultEditRequestForms(accounts, current));
    } catch (requestError) {
      setError(toUserFacingError('/api/dashboard', requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleNotificationToggle(notification: NotificationDto) {
    setLoading(true);
    setError('');
    try {
      await api.markNotificationRead(notification.id, !notification.readAt);
      setToast(notification.readAt ? 'Notification marked unread.' : 'Notification marked read.');
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not update this notification right now. Please try again.');
      setLoading(false);
    }
  }

  async function handleInvite(accountId: string) {
    const invite = inviteForms[accountId];
    const validationError = validateInvitationEmail(invite?.email ?? '');
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.inviteAccountMember(accountId, invite.email, invite.role);
      setInviteForms((current) => ({ ...current, [accountId]: { ...current[accountId], email: '' } }));
      setToast('Invitation sent.');
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not send this invitation right now. Please try again.');
      setLoading(false);
    }
  }

  async function handleRoleChange(accountId: string, memberUserId: string, role: string) {
    setLoading(true);
    setError('');
    try {
      await api.updateAccountMemberRole(accountId, memberUserId, role);
      setToast('Member role updated.');
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not update this member role right now. Please try again.');
      setLoading(false);
    }
  }

  async function handleRequestEdit(accountId: string) {
    const validationError = validateEditRequestMessage(requestEditForms[accountId] ?? '');
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.requestEditAccess(accountId, requestEditForms[accountId] ?? 'Please grant editor access.');
      setToast('Edit request sent to the account owner.');
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not send your edit request right now. Please try again.');
      setLoading(false);
    }
  }

  async function handleAcceptInvitation() {
    const validationError = validateInvitationToken(acceptInviteToken);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.acceptInvitation(acceptInviteToken.trim());
      setAcceptInviteToken('');
      setToast('Invitation accepted.');
      await refreshData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not accept this invitation right now. Please try again.');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      void refreshData();
    } else {
      setBundle(null);
    }
  }, [token]);

  useEffect(() => {
    localStorage.setItem(LAST_SECTION_STORAGE_KEY, section);
    const url = new URL(window.location.href);
    url.searchParams.set('section', section);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [section]);

  function resetWorkspaceForLogout() {
    setBundle(null);
    setSection('dashboard');
  }

  return {
    section,
    setSection,
    bundle,
    refreshData,
    inviteForms,
    setInviteForms,
    requestEditForms,
    setRequestEditForms,
    acceptInviteToken,
    setAcceptInviteToken,
    handleNotificationToggle,
    handleInvite,
    handleRoleChange,
    handleRequestEdit,
    handleAcceptInvitation,
    resetWorkspaceForLogout,
  };
}
