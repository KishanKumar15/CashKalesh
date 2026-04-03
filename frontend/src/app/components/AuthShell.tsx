import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';

type AuthShellSlide = {
  eyebrow: string;
  title: string;
  body: string;
  accents: string[];
  themeClass: string;
};

const authShellSlides: AuthShellSlide[] = [
  {
    eyebrow: 'CASHKALESH',
    title: 'Stay clear, calm, and ahead of your money.',
    body: 'A calmer money workspace for budgets, goals, reports, forecasts, and the everyday decisions around them.',
    accents: ['Budget clarity', 'Daily flow', 'Premium reports'],
    themeClass: 'auth-hero-v4__slide--branding',
  },
  {
    eyebrow: 'PLANNING',
    title: 'Build weekly control with budgets and safer spending.',
    body: 'See where this month is drifting, catch risky dates early, and keep your categories moving with intent.',
    accents: ['Budget coaching', 'Forecast warnings', 'Safe-to-spend'],
    themeClass: 'auth-hero-v4__slide--planning',
  },
  {
    eyebrow: 'TOGETHER',
    title: 'Plan, save, and manage shared goals without confusion.',
    body: 'Coordinate household accounts, couple goals, and shared progress inside one premium workspace.',
    accents: ['Shared accounts', 'Goal tracking', 'Role clarity'],
    themeClass: 'auth-hero-v4__slide--shared',
  },
];

export function AuthShell({
  title,
  subtitle,
  activeSlide,
  onSlideChange,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  activeSlide: number;
  onSlideChange: (index: number) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const safeSlideIndex = Number.isFinite(activeSlide)
    ? ((activeSlide % authShellSlides.length) + authShellSlides.length) % authShellSlides.length
    : 0;
  const currentSlide = authShellSlides[safeSlideIndex];

  return (
    <div className="auth-page-v4 min-h-svh w-full overflow-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
      <div className="auth-page-v4__glow auth-page-v4__glow--left" aria-hidden="true" />
      <div className="auth-page-v4__glow auth-page-v4__glow--right" aria-hidden="true" />

      <div className="auth-shell-v4 mx-auto grid w-full max-w-[1240px] grid-cols-1 overflow-hidden rounded-[32px] lg:grid-cols-2">
        <section className="auth-shell-v4__visual min-w-0">
          <div className="auth-hero-v4">
            <div className="auth-hero-v4__topbar">
              <BrandMark compact />
            </div>

            <div className="auth-hero-v4__media relative overflow-hidden rounded-[22px]">
              <div className={`auth-hero-v4__slide ${currentSlide.themeClass} is-active`}>
                <div className="auth-hero-v4__slideGlow auth-hero-v4__slideGlow--primary" />
                <div className="auth-hero-v4__slideGlow auth-hero-v4__slideGlow--secondary" />
                <div className="auth-hero-v4__slideArc auth-hero-v4__slideArc--back" />
                <div className="auth-hero-v4__slideArc auth-hero-v4__slideArc--front" />
                <div className="auth-hero-v4__copy">
                  <p className="auth-hero-v4__eyebrow">{currentSlide.eyebrow}</p>
                  <h2>{currentSlide.title}</h2>
                  <p>{currentSlide.body}</p>
                  <div className="auth-hero-v4__accents">
                    {currentSlide.accents.map((accent) => (
                      <span key={accent} className="auth-hero-v4__accentChip">{accent}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-hero-v4__dots" aria-label="Auth story slides">
              {authShellSlides.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  className={index === safeSlideIndex ? 'is-active' : ''}
                  aria-label={`Show slide ${index + 1}`}
                  onClick={() => onSlideChange(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="auth-shell-v4__form min-w-0">
          <div className="auth-form-v4 w-full max-w-[448px]">
            <header className="auth-form-v4__header">
              <h1>{title}</h1>
              <div className="auth-form-v4__subtitle">{subtitle}</div>
            </header>

            <div className="auth-form-v4__stage">
              {children}
            </div>

            <footer className="auth-form-v4__footer">
              {footer}
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}
