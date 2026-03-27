export type AppIconName =
  | 'overview'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'insights'
  | 'reports'
  | 'accounts'
  | 'recurring'
  | 'notifications'
  | 'rules'
  | 'settings'
  | 'search'
  | 'refresh'
  | 'theme'
  | 'quick'
  | 'logout';

function IconPath({ name }: { name: AppIconName }) {
  switch (name) {
    case 'overview':
      return <path d="M4 4h6v6H4zm10 0h6v4h-6zM4 14h4v6H4zm8-2h8v8h-8z" />;
    case 'transactions':
      return <path d="M5 7h14M5 12h10M5 17h14m-3-3 3-2-3-2M8 14l-3 2 3 2" />;
    case 'budgets':
      return <path d="M4 7h16M7 4v6m10-6v6M5 10h14v10H5z" />;
    case 'goals':
      return <path d="M12 4v16m0-16 5 5m-5-5-5 5M7 14c1.2-1.2 2.8-2 5-2s3.8.8 5 2" />;
    case 'insights':
      return <path d="M5 17 9 9l4 4 6-8M5 5h14v14H5z" />;
    case 'reports':
      return <path d="M6 18V6m6 12V10m6 8V4" />;
    case 'accounts':
      return <path d="M4 8h16v10H4zM7 6h10M7 13h5" />;
    case 'recurring':
      return <path d="M18 8V4h-4M6 16v4h4M18 8a7 7 0 0 0-12-3M6 16a7 7 0 0 0 12 3" />;
    case 'notifications':
      return <path d="M12 4a4 4 0 0 0-4 4v2.5L6 14v1h12v-1l-2-3.5V8a4 4 0 0 0-4-4zm0 16a2.5 2.5 0 0 0 2.3-1.5h-4.6A2.5 2.5 0 0 0 12 20z" />;
    case 'rules':
      return <path d="M8 6h10M8 12h10M8 18h10M4 6h.01M4 12h.01M4 18h.01" />;
    case 'settings':
      return <path d="M12 4.5 14 5l1 2 2 .5.5 2-1.5 1.5.1 2.2L14 15l-2 1-2-1-2.1.2.1-2.2L6.5 11 7 9l2-.5 1-2 2-.5zm0 4.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />;
    case 'search':
      return <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm8 14-3.4-3.4" />;
    case 'refresh':
      return <path d="M18 8V4h-4M6 16v4h4M18 8a7 7 0 0 0-12-3M6 16a7 7 0 0 0 12 3" />;
    case 'theme':
      return <path d="M12 3a7.5 7.5 0 1 0 9 9A8.5 8.5 0 0 1 12 3z" />;
    case 'quick':
      return <path d="M12 3v18M3 12h18" />;
    case 'logout':
      return <path d="M10 6V4H5v16h5v-2m-1-6h11m0 0-3-3m3 3-3 3" />;
    default:
      return <path d="M4 4h16v16H4z" />;
  }
}

export function AppIcon({ name, title }: { name: AppIconName; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <IconPath name={name} />
    </svg>
  );
}
