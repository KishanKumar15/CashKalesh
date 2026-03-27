export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand-lockup compact' : 'brand-lockup'}>
      <div className="brand-mark" aria-label="CASHKALESH">
        <span>CASHKALESH</span>
      </div>
    </div>
  );
}

export function ProfileAvatar({ name, imageUrl, size = 'md' }: { name: string; imageUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'C';

  return (
    <div className={`profile-avatar ${size}`} aria-label={`${name} profile`}>
      {imageUrl ? <img src={imageUrl} alt={`${name} profile`} /> : <span>{initials}</span>}
    </div>
  );
}
