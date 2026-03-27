import { buildQueryString } from '../app/viewModels';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; displayName: string };
};

export type UserProfileDto = {
  displayName: string;
  email: string;
  headline?: string | null;
  phoneNumber?: string | null;
  city?: string | null;
  profileImageUrl?: string | null;
};

export type UserProfileUpdateRequest = {
  displayName: string;
  headline?: string | null;
  phoneNumber?: string | null;
  city?: string | null;
  profileImageUrl?: string | null;
};

export type DashboardResponse = {
  income: number;
  expense: number;
  net: number;
  budgets: BudgetDto[];
  spendingByCategory: { category: string; amount: number }[];
  incomeExpenseTrend: { label: string; income: number; expense: number; balance: number }[];
  recentTransactions: TransactionDto[];
  upcomingRecurring: RecurringItemDto[];
  goals: GoalDto[];
  forecast: ForecastMonthResponse;
  healthScore: HealthScoreResponse;
  insights: InsightCardDto[];
};

export type AccountDto = { id: string; name: string; type: string; openingBalance: number; currentBalance: number; color: string; icon: string; institutionName?: string | null };
export type AccountUpsertRequest = { name: string; type: string; openingBalance: number; color: string; icon: string; institutionName?: string | null };
export type CategoryDto = { id: string; name: string; type: string; color: string; icon: string; isArchived: boolean };
export type CategoryUpsertRequest = { name: string; type: string; color: string; icon: string; isArchived: boolean };
export type TransactionDto = { id: string; accountId: string; accountName: string; transferAccountId?: string | null; categoryId?: string | null; categoryName?: string | null; type: string; amount: number; transactionDate: string; merchant: string; note: string; paymentMethod: string; tags: string[] };
export type BudgetDto = { id: string; categoryId: string; categoryName: string; month: number; year: number; amount: number; spent: number; healthPercent: number; accountId?: string | null; accountName?: string | null; isShared: boolean; canEdit: boolean };
export type BudgetUpsertRequest = { categoryId: string; month: number; year: number; amount: number; alertThresholdPercent: number; accountId?: string | null };
export type GoalParticipantDto = { userId: string; email: string; displayName: string; role: string };
export type GoalDto = { id: string; name: string; targetAmount: number; currentAmount: number; targetDate?: string | null; icon: string; color: string; status: string; linkedAccountId?: string | null; linkedAccountName?: string | null; isShared: boolean; ownerDisplayName: string; participants: GoalParticipantDto[] };
export type GoalUpsertRequest = { name: string; targetAmount: number; targetDate?: string | null; linkedAccountId?: string | null; icon: string; color: string };
export type GoalEntryRequest = { accountId?: string | null; type: string; amount: number; note: string };
export type RecurringItemDto = { id: string; title: string; type: string; amount: number; nextRunDate: string; isPaused: boolean; frequency: string; accountId: string; accountName: string; categoryId?: string | null; categoryName?: string | null; startDate: string; endDate?: string | null; autoCreateTransaction: boolean };
export type RecurringUpsertRequest = { title: string; type: string; amount: number; accountId: string; categoryId?: string | null; frequency: string; startDate: string; endDate?: string | null; autoCreateTransaction: boolean; isPaused: boolean };
export type ReportResponse = { monthlyTrend: { label: string; income: number; expense: number; balance: number }[]; categoryBreakdown: { category: string; amount: number }[]; accountBalanceTrend: { label: string; income: number; expense: number; balance: number }[]; savingsProgress: { goal: string; progressPercent: number; currentAmount: number; targetAmount: number }[]; savingsRateTrend: { label: string; income: number; expense: number; balance: number }[] };
export type ForecastMonthResponse = { projectedEndBalance: number; safeToSpend: number; confidence: string; warnings: string[] };
export type ForecastDailyPoint = { date: string; projectedBalance: number };
export type HealthScoreResponse = { score: number; factors: { name: string; score: number; description: string }[]; suggestions: string[] };
export type InsightCardDto = { title: string; message: string; tone: string };
export type RuleConditionDto = { field: string; operator: string; value: string };
export type RuleActionDto = { type: string; value: string };
export type RuleDto = { id: string; priority: number; isActive: boolean; conditions: RuleConditionDto[]; actions: RuleActionDto[] };
export type RuleUpsertRequest = { priority: number; isActive: boolean; conditions: RuleConditionDto[]; actions: RuleActionDto[] };
export type NotificationDto = { id: string; type: string; title: string; body: string; emailSent: boolean; createdAt: string; readAt?: string | null };
export type AppBrandingResponse = { appName: string; currencyCode: string; locale: string; notificationMode: string; deploymentTarget: string; pdfExportStyle: string };
export type AccountMemberDto = { userId: string; email: string; displayName: string; role: string; permissions: string };
export type TransactionQueryParams = { search?: string; accountId?: string; categoryId?: string; type?: string; from?: string; to?: string; page?: number; pageSize?: number };
export type ReportQueryParams = { from?: string; to?: string; accountId?: string; categoryId?: string; type?: string };
export type TransactionUpsertRequest = { accountId: string; transferAccountId?: string | null; categoryId?: string | null; type: string; amount: number; transactionDate: string; merchant: string; note: string; paymentMethod: string; tags: string[] };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080';
const ACCESS_TOKEN_KEY = 'pft_access_token';
const REFRESH_TOKEN_KEY = 'pft_refresh_token';
const USER_ID_KEY = 'pft_user_id';
const USER_NAME_KEY = 'pft_user_name';
const USER_EMAIL_KEY = 'pft_user_email';
export const SESSION_EXPIRED_EVENT = 'pft:session-expired';

function clearStoredSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
}

function handleUnauthorizedResponse(path: string, status: number) {
  if (status !== 401) return;
  if (path.startsWith('/api/auth')) return;
  clearStoredSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

function sanitizeServerMessage(message: string) {
  return message.replace(/^"+|"+$/g, '').trim();
}

function isTechnicalMessage(message: string) {
  return /failed to fetch|networkerror|cors|typeerror|unexpected token|npgsql|system\.|socketexception|econnrefused/i.test(message);
}

function getOfflineMessage(path: string) {
  if (path.startsWith('/api/auth')) {
    return 'We could not reach CASHKALESH right now. Please check that the app is running and try again.';
  }

  return 'We could not connect to CASHKALESH. Please check your internet or server connection and try again.';
}

export function getFriendlyError(path: string, status: number, message: string) {
  const cleanMessage = sanitizeServerMessage(message);

  if (status === 401 && path === '/api/auth/login') {
    return 'Email or password is incorrect.';
  }

  if (status === 401 && path === '/api/auth/google') {
    return 'Google sign-in could not be completed. Please try again.';
  }

  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 403) {
    return 'You do not have permission to do that.';
  }

  if (status === 404) {
    return 'We could not find what you were looking for.';
  }

  if (status === 409 && path === '/api/auth/register') {
    return 'An account with this email already exists. Try logging in instead.';
  }

  if (status === 409) {
    return 'That item already exists or was changed by someone else. Refresh and try again.';
  }

  if (status === 400 && path === '/api/auth/register' && cleanMessage) {
    return isTechnicalMessage(cleanMessage) ? 'We could not create your account right now. Please review your details and try again.' : cleanMessage;
  }

  if (status === 400 && path === '/api/auth/reset-password' && cleanMessage) {
    return isTechnicalMessage(cleanMessage) ? 'That reset link or password could not be accepted. Please try again.' : cleanMessage;
  }

  if (status === 400 && path === '/api/auth/forgot-password' && cleanMessage) {
    return isTechnicalMessage(cleanMessage) ? 'We could not start password reset right now. Please try again.' : cleanMessage;
  }

  if (status >= 500) {
    return 'CASHKALESH is having trouble right now. Please try again in a moment.';
  }

  if (!cleanMessage) {
    return 'Something went wrong. Please try again.';
  }

  if (isTechnicalMessage(cleanMessage)) {
    return 'Something went wrong while talking to CASHKALESH. Please try again.';
  }

  return cleanMessage;
}

export function toUserFacingError(path: string, error: unknown) {
  if (error instanceof Error) {
    if (isTechnicalMessage(error.message)) {
      return getOfflineMessage(path);
    }

    return error.message.trim() || 'Something went wrong. Please try again.';
  }

  return 'Something went wrong. Please try again.';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('pft_access_token');
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(toUserFacingError(path, error));
  }

  if (!response.ok) {
    handleUnauthorizedResponse(path, response.status);
    const message = await response.text();
    throw new Error(getFriendlyError(path, response.status, message || ''));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function download(path: string, filename: string) {
  const token = localStorage.getItem('pft_access_token');
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (error) {
    throw new Error(toUserFacingError(path, error));
  }

  if (!response.ok) {
    handleUnauthorizedResponse(path, response.status);
    const message = await response.text();
    throw new Error(getFriendlyError(path, response.status, message || ''));
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 500);
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, displayName: string) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
  googleLogin: (credential: string) => request<AuthResponse>('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  logout: (refreshToken: string) => request<void>('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  forgotPassword: (email: string) => request<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) => request<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  profileMe: () => request<UserProfileDto>('/api/profile/me'),
  updateProfile: (payload: UserProfileUpdateRequest) => request<UserProfileDto>('/api/profile/me', { method: 'PUT', body: JSON.stringify(payload) }),
  appInfo: () => request<AppBrandingResponse>('/api/app/info'),
  dashboard: () => request<DashboardResponse>('/api/dashboard'),
  accounts: () => request<AccountDto[]>('/api/accounts'),
  createAccount: (payload: AccountUpsertRequest) => request<AccountDto>('/api/accounts', { method: 'POST', body: JSON.stringify(payload) }),
  updateAccount: (id: string, payload: AccountUpsertRequest) => request<AccountDto>(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  categories: () => request<CategoryDto[]>('/api/categories'),
  createCategory: (payload: CategoryUpsertRequest) => request<CategoryDto>('/api/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (id: string, payload: CategoryUpsertRequest) => request<CategoryDto>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  transactions: (params: TransactionQueryParams = {}) => request<TransactionDto[]>(`/api/transactions${buildQueryString({ page: 1, pageSize: 200, ...params })}`),
  createTransaction: (payload: TransactionUpsertRequest) => request<TransactionDto>('/api/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  updateTransaction: (id: string, payload: TransactionUpsertRequest) => request<TransactionDto>(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTransaction: (id: string) => request<void>(`/api/transactions/${id}`, { method: 'DELETE' }),
  budgets: (params: { month?: number; year?: number } = {}) => request<BudgetDto[]>(`/api/budgets${buildQueryString(params)}`),
  createBudget: (payload: BudgetUpsertRequest) => request<void>('/api/budgets', { method: 'POST', body: JSON.stringify(payload) }),
  updateBudget: (id: string, payload: BudgetUpsertRequest) => request<void>(`/api/budgets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteBudget: (id: string) => request<void>(`/api/budgets/${id}`, { method: 'DELETE' }),
  duplicateLastMonthBudget: () => request<void>('/api/budgets/duplicate-last-month', { method: 'POST' }),
  goals: () => request<GoalDto[]>('/api/goals'),
  createGoal: (payload: GoalUpsertRequest) => request<GoalDto>('/api/goals', { method: 'POST', body: JSON.stringify(payload) }),
  updateGoal: (id: string, payload: GoalUpsertRequest) => request<GoalDto>(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  addGoalEntry: (id: string, payload: GoalEntryRequest) => request<GoalDto>(`/api/goals/${id}/entries`, { method: 'POST', body: JSON.stringify(payload) }),
  completeGoal: (id: string) => request<GoalDto>(`/api/goals/${id}/complete`, { method: 'POST' }),
  recurring: () => request<RecurringItemDto[]>('/api/recurring'),
  createRecurring: (payload: RecurringUpsertRequest) => request<void>('/api/recurring', { method: 'POST', body: JSON.stringify(payload) }),
  updateRecurring: (id: string, payload: RecurringUpsertRequest) => request<void>(`/api/recurring/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  pauseRecurring: (id: string) => request<void>(`/api/recurring/${id}/pause`, { method: 'POST' }),
  resumeRecurring: (id: string) => request<void>(`/api/recurring/${id}/resume`, { method: 'POST' }),
  deleteRecurring: (id: string) => request<void>(`/api/recurring/${id}`, { method: 'DELETE' }),
  reports: (params: ReportQueryParams = {}) => request<ReportResponse>(`/api/reports${buildQueryString(params)}`),
  forecastMonth: () => request<ForecastMonthResponse>('/api/forecast/month'),
  forecastDaily: () => request<ForecastDailyPoint[]>('/api/forecast/daily'),
  healthScore: () => request<HealthScoreResponse>('/api/insights/health-score'),
  insights: () => request<InsightCardDto[]>('/api/insights'),
  rules: () => request<RuleDto[]>('/api/rules'),
  createRule: (payload: RuleUpsertRequest) => request<void>('/api/rules', { method: 'POST', body: JSON.stringify(payload) }),
  updateRule: (id: string, payload: RuleUpsertRequest) => request<void>(`/api/rules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteRule: (id: string) => request<void>(`/api/rules/${id}`, { method: 'DELETE' }),
  notifications: () => request<NotificationDto[]>('/api/notifications'),
  markNotificationRead: (id: string, read: boolean) => request<void>(`/api/notifications/${id}/read`, { method: 'PUT', body: JSON.stringify({ read }) }),
  accountMembers: (accountId: string) => request<AccountMemberDto[]>(`/api/accounts/${accountId}/members`),
  inviteAccountMember: (accountId: string, email: string, role: string) => request(`/api/accounts/${accountId}/invite`, { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateAccountMemberRole: (accountId: string, memberUserId: string, role: string) => request<void>(`/api/accounts/${accountId}/members/${memberUserId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
  acceptInvitation: (token: string) => request(`/api/accounts/invitations/accept/${token}`, { method: 'POST' }),
  requestEditAccess: (accountId: string, message: string) => request(`/api/accounts/${accountId}/request-edit`, { method: 'POST', body: JSON.stringify({ message }) }),
  quickParse: (input: string) => request<{ type: string; amount: number; categoryHint?: string; accountHint?: string; merchant: string; transactionDate: string; chips: string[] }>('/api/transactions/quick-parse', { method: 'POST', body: JSON.stringify({ input }) }),
  downloadReportPdf: (params: ReportQueryParams = {}) => download(`/api/reports/export/pdf${buildQueryString(params)}`, 'cashkalesh-report.pdf'),
  downloadReportCsv: (params: ReportQueryParams = {}) => download(`/api/reports/export/csv-branded${buildQueryString(params)}`, 'cashkalesh-report.csv'),
};


