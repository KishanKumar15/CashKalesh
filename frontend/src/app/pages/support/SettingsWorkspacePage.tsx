import { useEffect, useRef, useState } from 'react';
import type { AppBrandingResponse } from '../../../services/api';
import { ProfileAvatar } from '../../components/BrandMark';
import type { Section } from '../../types';
import { uiButtonClass, uiHeroClass, uiInputClass, uiPanelClass } from '../finance/ui';

type ProfileDetails = {
  displayName: string;
  headline: string;
  phone: string;
  city: string;
};

export function SettingsWorkspacePage({
  userName,
  userEmail,
  branding,
  theme,
  defaultSection,
  reduceMotion,
  profileImageUrl,
  onThemeToggle,
  onDefaultSectionChange,
  onReduceMotionChange,
  onProfileImageChange,
  onProfileImageRemove,
  profileDetails,
  onProfileDetailsSave,
  focusProfileToken = 0,
}: {
  userName: string;
  userEmail: string;
  branding: AppBrandingResponse;
  theme: string;
  defaultSection: Section;
  reduceMotion: boolean;
  profileImageUrl?: string | null;
  onThemeToggle: () => void;
  onDefaultSectionChange: (value: Section) => void;
  onReduceMotionChange: (value: boolean) => void;
  onProfileImageChange: (file: File | null) => void;
  onProfileImageRemove: () => void;
  profileDetails: ProfileDetails;
  onProfileDetailsSave: (value: ProfileDetails) => void;
  focusProfileToken?: number;
}) {
  const [profileDraft, setProfileDraft] = useState<ProfileDetails>(profileDetails);
  const [highlightProfile, setHighlightProfile] = useState(false);
  const profileSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setProfileDraft(profileDetails);
  }, [profileDetails]);

  useEffect(() => {
    if (!focusProfileToken) return;
    profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightProfile(true);
    const timeout = window.setTimeout(() => setHighlightProfile(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [focusProfileToken]);

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Workspace Settings</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Keep identity, defaults, and environment context in one place.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Preferences are editable so the shell remembers how you want CASHKALESH to feel every session.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Currency</span><strong className="mt-2 block text-2xl text-white">{branding.currencyCode}</strong></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Locale</span><strong className="mt-2 block text-2xl text-sky-100">{branding.locale}</strong></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Notifications</span><strong className="mt-2 block text-2xl text-emerald-100">{branding.notificationMode}</strong></div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Export style</span><strong className="mt-2 block text-2xl text-white">{branding.pdfExportStyle}</strong></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section ref={profileSectionRef} className={`${uiPanelClass} ${highlightProfile ? 'ring-2 ring-sky-300/50' : ''}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Profile</h3>
            <span className="text-sm text-[var(--muted)]">Signed-in identity</span>
          </div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <ProfileAvatar name={profileDraft.displayName || userName} imageUrl={profileImageUrl} size="lg" />
            <div className="grid gap-1">
              <strong className="text-[var(--text)]">Profile photo</strong>
              <span className="text-sm text-[var(--muted)]">Upload a personal avatar for the topbar and workspace profile chip.</span>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2.5">
            <label className={uiButtonClass('ghost')}>
              Upload picture
              <input type="file" accept="image/*" onChange={(event) => onProfileImageChange(event.target.files?.[0] ?? null)} hidden />
            </label>
            {profileImageUrl && <button className={uiButtonClass('ghost')} type="button" onClick={onProfileImageRemove}>Remove picture</button>}
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Display name
              <input className={uiInputClass} value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Profile headline
              <input className={uiInputClass} value={profileDraft.headline} onChange={(event) => setProfileDraft((current) => ({ ...current, headline: event.target.value }))} placeholder="Planning and accountability partner" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm text-[var(--muted)]">Phone
                <input className={uiInputClass} value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="+91 ..." />
              </label>
              <label className="grid gap-1.5 text-sm text-[var(--muted)]">City
                <input className={uiInputClass} value={profileDraft.city} onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))} placeholder="Indore" />
              </label>
            </div>
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Email</strong><span>{userEmail}</span></div>
              <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Timezone</strong><span>Asia/Calcutta</span></div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button className={uiButtonClass('ghost')} onClick={() => setProfileDraft(profileDetails)}>Reset details</button>
              <button className={uiButtonClass('primary')} onClick={() => onProfileDetailsSave(profileDraft)}>Save profile details</button>
            </div>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Experience preferences</h3>
            <span className="text-sm text-[var(--muted)]">Saved in this browser</span>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Default landing section
              <select className={uiInputClass} value={defaultSection} onChange={(event) => onDefaultSectionChange(event.target.value as Section)}>
                <option value="dashboard">Dashboard</option>
                <option value="transactions">Transactions</option>
                <option value="budgets">Budgets</option>
                <option value="goals">Goals</option>
                <option value="insights">Insights</option>
                <option value="reports">Reports</option>
                <option value="accounts">Accounts</option>
                <option value="settings">Settings</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2.5">
              <button className={uiButtonClass('ghost')} type="button" onClick={onThemeToggle}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-[var(--muted)]"><input type="checkbox" checked={reduceMotion} onChange={(event) => onReduceMotionChange(event.target.checked)} />Reduce motion and hover lift</label>
          </div>
        </section>
      </div>

    </div>
  );
}
