import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBranding, type Branding } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';

const DEFAULT_TITLE = 'containr';

/**
 * Loads the instance's white-label branding (public endpoint) and applies
 * it: document title, favicon, and the accent CSS variable. Defaults keep
 * the app Containr-branded.
 */
export function useBranding(): Branding {
  const isDemoMode = useDemoMode();
  const brandingQuery = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
    staleTime: 5 * 60_000,
    enabled: !isDemoMode,
  });

  const branding = brandingQuery.data ?? {
    productName: 'Containr',
    logoUrl: '',
    faviconUrl: '',
    accentColor: '',
    docsUrl: '',
    supportUrl: '',
  };

  useEffect(() => {
    const name = branding.productName;
    document.title = name && name !== 'Containr' ? name : DEFAULT_TITLE;

    const root = document.documentElement;
    if (branding.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(branding.accentColor)) {
      root.style.setProperty('--accent-primary', branding.accentColor);
    } else {
      root.style.removeProperty('--accent-primary');
    }

    if (branding.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = branding.faviconUrl;
    }
  }, [branding.productName, branding.accentColor, branding.faviconUrl]);

  return branding;
}
