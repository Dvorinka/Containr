import { useBranding } from '@/lib/use-branding';

/**
 * Instance wordmark — renders the configured logo when set, otherwise the
 * product name with the signature accent on the last character
 * ("contain[r]"). Falls back to Containr branding.
 */
export function BrandWordmark({ className = '' }: { className?: string }) {
  const branding = useBranding();

  if (branding.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.productName}
        className={`h-6 w-auto object-contain ${className}`}
      />
    );
  }

  const name = branding.productName;
  return (
    <span className={className}>
      {name.slice(0, -1)}
      <span style={{ color: 'var(--accent-primary)' }}>{name.slice(-1)}</span>
    </span>
  );
}
