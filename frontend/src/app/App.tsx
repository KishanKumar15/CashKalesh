import { Suspense, lazy, useEffect, useState } from 'react';
import { SESSION_EXPIRED_EVENT, api, type InsightCardDto, type TransactionDto, type UserProfileDto } from '../services/api';
import { navItems } from './constants';
import type { AppToast, Section } from './types';
import { AppIcon } from './components/AppIcon';
import { AuthScreen } from './components/AuthScreen';
import { BrandMark, ProfileAvatar } from './components/BrandMark';
import { QuickAddPalette } from './components/QuickAddPalette';
import { useAuthSession } from './hooks/useAuthSession';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { createRuleDraftFromInsight, type RuleComposerState } from './pages/support';

const DashboardCommandCenter = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardCommandCenter })));
const TransactionsManagerPage = lazy(() => import('./pages/finance/TransactionsManagerPage').then((module) => ({ default: module.TransactionsManagerPage })));
const BudgetsManagerPage = lazy(() => import('./pages/finance/BudgetsManagerPage').then((module) => ({ default: module.BudgetsManagerPage })));
const GoalsStudioPage = lazy(() => import('./pages/GoalsPage').then((module) => ({ default: module.GoalsStudioPage })));
const ReportsManagerPage = lazy(() => import('./pages/finance/ReportsManagerPage').then((module) => ({ default: module.ReportsManagerPage })));
const RecurringManagerPage = lazy(() => import('./pages/finance/RecurringManagerPage').then((module) => ({ default: module.RecurringManagerPage })));
const AccountsStudioPage = lazy(() => import('./pages/AccountsPage').then((module) => ({ default: module.AccountsStudioPage })));
const NotificationsPage = lazy(() => import('./pages/support/NotificationsInboxPage').then((module) => ({ default: module.NotificationsInboxPage })));
const InsightsPage = lazy(() => import('./pages/support/InsightsStudioPage').then((module) => ({ default: module.InsightsStudioPage })));
const RulesPage = lazy(() => import('./pages/support/RulesStudioPage').then((module) => ({ default: module.RulesStudioPage })));
const SettingsPage = lazy(() => import('./pages/support/SettingsWorkspacePage').then((module) => ({ default: module.SettingsWorkspacePage })));

const REDUCE_MOTION_KEY = 'cashkalesh_reduce_motion';
const DEFAULT_SECTION_KEY = 'cashkalesh_default_section';
const PROFILE_IMAGE_KEY = 'cashkalesh_profile_image';
const PROFILE_DETAILS_KEY = 'cashkalesh_profile_details';

type ProfileDetails = {
  displayName: string;
  headline: string;
  phone: string;
  city: string;
};

function readProfileDetails() {
  try {
    const raw = localStorage.getItem(PROFILE_DETAILS_KEY);
    if (!raw) return { displayName: '', headline: '', phone: '', city: '' } satisfies ProfileDetails;
    const parsed = JSON.parse(raw) as Partial<ProfileDetails>;
    return {
      displayName: parsed.displayName ?? '',
      headline: parsed.headline ?? '',
      phone: parsed.phone ?? '',
      city: parsed.city ?? '',
    } satisfies ProfileDetails;
  } catch {
    return { displayName: '', headline: '', phone: '', city: '' } satisfies ProfileDetails;
  }
}

function mapProfileDtoToDetails(profile: UserProfileDto): ProfileDetails {
  return {
    displayName: profile.displayName ?? '',
    headline: profile.headline ?? '',
    phone: profile.phoneNumber ?? '',
    city: profile.city ?? '',
  };
}

function WorkspaceSkeleton() {
  return (
    <div className="page-grid">
      <div className="card loading-card" />
      <div className="card loading-card" />
      <div className="card loading-card" />
      <div className="card loading-card" />
    </div>
  );
}

function SectionSkeleton({ section }: { section: Section }) {
  if (section === 'dashboard') {
    return (
      <div className="card-stack">
        <div className="hero-card loading-card section-skeleton hero-skeleton" />
        <div className="dashboard-grid-premium">
          <div className="card loading-card section-skeleton" />
          <div className="card loading-card section-skeleton" />
          <div className="card loading-card section-skeleton" />
          <div className="card loading-card section-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-stack">
      <div className="hero-card loading-card section-skeleton hero-skeleton" />
      <div className="two-column-grid manager-grid">
        <div className="card loading-card section-skeleton tall-skeleton" />
        <div className="card loading-card section-skeleton tall-skeleton" />
      </div>
    </div>
  );
}

function MobileBottomNav({ section, onSelect }: { section: Section; onSelect: (next: Section) => void; }) {
  const mobileItems = navItems.filter((item) => item.tier === 'primary').slice(0, 5);
  return (
    <nav className="mobile-bottom-nav">
      {mobileItems.map((item) => (
        <button key={item.key} className={section === item.key ? 'nav-item active' : 'nav-item'} onClick={() => onSelect(item.key)}>
          <span className="nav-item-icon"><AppIcon name={item.icon} /></span>
          <span>{item.shortLabel}</span>
        </button>
      ))}
    </nav>
  );
}

function ToastBanner({ toast, onDismiss }: { toast: AppToast; onDismiss: () => void; }) {
  return (
    <div className="toast premium-toast">
      <span>{toast.message}</span>
      <div className="row-actions compact-actions">
        {toast.onAction && toast.actionLabel && <button className="ghost-button" onClick={() => void toast.onAction?.()}>{toast.actionLabel}</button>}
        <button className="ghost-button" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

export function App() {
  const [theme, setTheme] = useState(localStorage.getItem('pft_theme') ?? 'dark');
  const [reduceMotion, setReduceMotion] = useState(localStorage.getItem(REDUCE_MOTION_KEY) === 'true');
  const [defaultSectionPreference, setDefaultSectionPreference] = useState<Section>(() => (localStorage.getItem(DEFAULT_SECTION_KEY) as Section | null) ?? 'dashboard');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(() => localStorage.getItem(PROFILE_IMAGE_KEY));
  const [profileDetails, setProfileDetails] = useState<ProfileDetails>(() => readProfileDetails());
  const [profileFocusToken, setProfileFocusToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToastState] = useState<AppToast | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingRuleDraft, setPendingRuleDraft] = useState<RuleComposerState | null>(null);
  const [profileLoadedFromApi, setProfileLoadedFromApi] = useState(false);

  function setToast(message: string) {
    setToastState({ message });
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pft_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    localStorage.setItem(REDUCE_MOTION_KEY, String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    localStorage.setItem(DEFAULT_SECTION_KEY, defaultSectionPreference);
  }, [defaultSectionPreference]);

  useEffect(() => {
    if (profileImageUrl) {
      localStorage.setItem(PROFILE_IMAGE_KEY, profileImageUrl);
    } else {
      localStorage.removeItem(PROFILE_IMAGE_KEY);
    }
  }, [profileImageUrl]);

  useEffect(() => {
    localStorage.setItem(PROFILE_DETAILS_KEY, JSON.stringify(profileDetails));
  }, [profileDetails]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowPalette((value) => !value);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToastState(null), toast.onAction ? 5000 : 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const {
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
  } = useWorkspaceData({ token: localStorage.getItem('pft_access_token'), setLoading, setError, setToast });

  const {
    token,
    userName,
    userEmail,
    googleClientId,
    googleButtonRef,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    handleAuth,
    handleLogout: logoutSession,
  } = useAuthSession({
    setLoading,
    setError,
    setToast,
    onSignedIn: refreshData,
    onSignedOut: resetWorkspaceForLogout,
  });

  useEffect(() => {
    if (!userName || profileDetails.displayName.trim()) return;
    setProfileDetails((current) => ({ ...current, displayName: userName }));
  }, [profileDetails.displayName, userName]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const profile = await api.profileMe();
        if (cancelled) return;
        setProfileDetails(mapProfileDtoToDetails(profile));
        setProfileImageUrl(profile.profileImageUrl ?? null);
        localStorage.setItem('pft_user_name', profile.displayName);
        setProfileLoadedFromApi(true);
      } catch {
        if (!cancelled) {
          setProfileLoadedFromApi(false);
        }
      }
    };

    void loadProfile();
    return () => { cancelled = true; };
  }, [token]);

  async function handleLogout() {
    await logoutSession();
  }

  useEffect(() => {
    const handleSessionExpired = () => {
      setShowPalette(false);
      setToastState({ message: 'Session expired. Please sign in again.' });
      void logoutSession();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [logoutSession]);

  const displayName = profileDetails.displayName.trim() || userName;

  async function showQuickAddSavedToast(transaction: TransactionDto) {
    setToastState({
      message: 'Transaction captured from Quick Add.',
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await api.deleteTransaction(transaction.id);
          await refreshData();
          setToastState({ message: 'Quick Add transaction removed.' });
        } catch (requestError) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to undo Quick Add transaction.');
        }
      },
    });
  }

  function handleCreateRuleFromInsight(insight: InsightCardDto) {
    setPendingRuleDraft(createRuleDraftFromInsight(insight));
    setSection('rules');
    setToast('Rule draft opened from insight.');
  }

  async function saveProfile(nextDetails: ProfileDetails, nextImageUrl: string | null, successMessage: string) {
    setError('');
    try {
      const updated = await api.updateProfile({
        displayName: nextDetails.displayName,
        headline: nextDetails.headline || null,
        phoneNumber: nextDetails.phone || null,
        city: nextDetails.city || null,
        profileImageUrl: nextImageUrl || null,
      });
      const mapped = mapProfileDtoToDetails(updated);
      setProfileDetails(mapped);
      setProfileImageUrl(updated.profileImageUrl ?? null);
      localStorage.setItem('pft_user_name', updated.displayName);
      setToast(successMessage);
      setProfileLoadedFromApi(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save your profile right now. Please try again.');
    }
  }

  function handleProfileImageChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!imageUrl) return;
      setProfileImageUrl(imageUrl);
      void saveProfile(profileDetails, imageUrl, 'Profile picture updated.');
    };
    reader.readAsDataURL(file);
  }

  function renderSection() {
    if (!bundle) return null;

    if (section === 'dashboard') return <DashboardCommandCenter bundle={bundle} onNavigate={setSection} />;
    if (section === 'transactions') return <TransactionsManagerPage accounts={bundle.accounts} categories={bundle.categories} transactions={bundle.transactions} initialSearch={search} onChanged={refreshData} setError={setError} setToast={setToast} />;
    if (section === 'budgets') return <BudgetsManagerPage accounts={bundle.accounts} categories={bundle.categories} initialBudgets={bundle.dashboard.budgets} onChanged={refreshData} setError={setError} setToast={setToast} />;
    if (section === 'goals') return <GoalsStudioPage goals={bundle.goals} accounts={bundle.accounts} onChanged={refreshData} setError={setError} setToast={setToast} />;
    if (section === 'reports') return <ReportsManagerPage reports={bundle.reports} forecastDaily={bundle.forecastDaily} forecastMonth={bundle.dashboard.forecast} recurring={bundle.recurring} accounts={bundle.accounts} categories={bundle.categories} setError={setError} setToast={setToast} />;
    if (section === 'recurring') return <RecurringManagerPage items={bundle.recurring} accounts={bundle.accounts} categories={bundle.categories} onChanged={refreshData} setError={setError} setToast={setToast} />;
    if (section === 'accounts') return <AccountsStudioPage accounts={bundle.accounts} categories={bundle.categories} accountMembers={bundle.accountMembers} currentUserEmail={userEmail} inviteForms={inviteForms} onInviteFormChange={setInviteForms} onInvite={handleInvite} onRoleChange={handleRoleChange} requestEditForms={requestEditForms} onRequestEditFormChange={setRequestEditForms} onRequestEdit={handleRequestEdit} acceptInviteToken={acceptInviteToken} onAcceptInviteTokenChange={setAcceptInviteToken} onAcceptInvitation={handleAcceptInvitation} onChanged={refreshData} setError={setError} setToast={setToast} />;
    if (section === 'notifications') return <NotificationsPage notifications={bundle.notifications} onToggleRead={handleNotificationToggle} />;
    if (section === 'insights') return <InsightsPage dashboard={bundle.dashboard} insights={bundle.insights} onCreateRule={handleCreateRuleFromInsight} setToast={setToast} />;
    if (section === 'rules') return <RulesPage rules={bundle.rules} accounts={bundle.accounts} categories={bundle.categories} pendingDraft={pendingRuleDraft} onDraftApplied={() => setPendingRuleDraft(null)} onChanged={refreshData} setError={setError} setToast={setToast} />;
    return <SettingsPage userName={displayName} userEmail={userEmail} branding={bundle.branding} theme={theme} defaultSection={defaultSectionPreference} reduceMotion={reduceMotion} profileImageUrl={profileImageUrl} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} onDefaultSectionChange={setDefaultSectionPreference} onReduceMotionChange={setReduceMotion} onProfileImageChange={handleProfileImageChange} onProfileImageRemove={() => { setProfileImageUrl(null); void saveProfile(profileDetails, null, 'Profile picture removed.'); }} profileDetails={profileDetails} onProfileDetailsSave={(value) => { setProfileDetails(value); void saveProfile(value, profileImageUrl, 'Profile details updated.'); }} focusProfileToken={profileFocusToken} />;
  }

  if (!token) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        authForm={authForm}
        setAuthForm={setAuthForm}
        error={error}
        loading={loading}
        onSubmit={() => void handleAuth()}
        googleClientId={googleClientId}
        googleButtonRef={googleButtonRef}
      />
    );
  }

  const primaryNavItems = navItems.filter((item) => item.tier === 'primary');
  const secondaryNavItems = navItems.filter((item) => item.tier === 'secondary');
  const activeItem = navItems.find((item) => item.key === section);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandMark />
        <div className="sidebar-scroll">
          <p className="sidebar-group-label">Main</p>
          <nav className="sidebar-nav-group">
            {primaryNavItems.map((item) => (
              <button key={item.key} className={section === item.key ? 'nav-item active' : 'nav-item'} onClick={() => setSection(item.key)}>
                <span className="nav-item-icon"><AppIcon name={item.icon} /></span>
                <span className="nav-item-label">{item.label}</span>
                <span className="nav-item-caret" aria-hidden="true">{section === item.key ? '>' : ''}</span>
              </button>
            ))}
          </nav>
          <button className="primary-button sidebar-quick-add-button" onClick={() => setShowPalette(true)}>
            <span className="nav-item-icon"><AppIcon name="quick" /></span>
            <span>Quick Add</span>
          </button>
          <div className="sidebar-divider" />
          <p className="sidebar-group-label">Workspace</p>
          <nav className="sidebar-nav-group secondary is-open">
            {secondaryNavItems.map((item) => (
              <button key={item.key} className={section === item.key ? 'nav-item active' : 'nav-item'} onClick={() => setSection(item.key)}>
                <span className="nav-item-icon"><AppIcon name={item.icon} /></span>
                <span className="nav-item-label">{item.label}</span>
                <span className="nav-item-caret" aria-hidden="true">{section === item.key ? '>' : ''}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <button className="ghost-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <span className="nav-item-icon"><AppIcon name="theme" /></span>
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button className="ghost-button" onClick={() => void handleLogout()}>
            <span className="nav-item-icon"><AppIcon name="logout" /></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-panel min-w-0">
        <header className="topbar">
          <div className="topbar-copy">
            <h1>{section === 'dashboard' ? `Hi, ${displayName.split(' ')[0] || displayName}!` : activeItem?.label ?? displayName}</h1>
            <span className="muted topbar-caption">{section === 'dashboard' ? 'A calmer view of balance, plans, and movement.' : activeItem?.shortLabel ?? 'Workspace'}</span>
          </div>
          <div className="topbar-actions">
            <label className="topbar-search">
              <span className="topbar-icon-button" aria-hidden="true"><AppIcon name="search" /></span>
              <input className="search-input" placeholder="Search operations" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <button className="topbar-icon-button" onClick={() => setShowPalette(true)} aria-label="Open quick add"><AppIcon name="quick" /></button>
            <button className="topbar-icon-button" onClick={() => void refreshData()} aria-label="Refresh workspace"><AppIcon name="refresh" /></button>
            <button className="topbar-icon-button" onClick={() => setSection('notifications')} aria-label="Open alerts"><AppIcon name="notifications" /></button>
            <button
              className="profile-chip profile-chip-button"
              type="button"
              onClick={() => {
                setSection('settings');
                setProfileFocusToken((current) => current + 1);
              }}
            >
              <ProfileAvatar name={displayName} imageUrl={profileImageUrl} size="sm" />
              <div className="profile-chip-copy">
                <strong>{displayName}</strong>
                <span>{profileLoadedFromApi ? (userEmail || 'cashkalesh@local') : 'Loading profile...'}</span>
              </div>
            </button>
          </div>
        </header>

        <div className="main-content-scroll">
          {error && <div className="error-banner">{error}</div>}
          {loading && !bundle && <WorkspaceSkeleton />}

          {bundle && (
            <Suspense fallback={<SectionSkeleton section={section} />}>
              <div className="workspace-section-stage">
                {renderSection()}
              </div>
            </Suspense>
          )}
        </div>
      </main>

      <MobileBottomNav section={section} onSelect={setSection} />

      {showPalette && bundle && (
        <QuickAddPalette
          accounts={bundle.accounts}
          categories={bundle.categories}
          recentTransactions={bundle.transactions}
          onClose={() => setShowPalette(false)}
          onSaved={async (transaction) => {
            setShowPalette(false);
            await refreshData();
            await showQuickAddSavedToast(transaction);
          }}
        />
      )}

      {toast && <ToastBanner toast={toast} onDismiss={() => setToastState(null)} />}
    </div>
  );
}
