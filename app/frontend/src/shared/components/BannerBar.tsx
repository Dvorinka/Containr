import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, Megaphone, X, XCircle } from 'lucide-react';
import { listActiveBanners, type Banner } from '@/lib/api-client';
import { useDemoMode } from '@/lib/demo-mode';

const DISMISSED_KEY = 'containr.dismissed-banners';

function dismissedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

const levelStyle: Record<Banner['level'], { bg: string; fg: string; icon: typeof Info }> = {
  info: { bg: 'var(--accent-primary-soft)', fg: 'var(--accent-primary)', icon: Info },
  success: { bg: 'var(--success-soft)', fg: 'var(--success)', icon: CheckCircle2 },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', icon: AlertTriangle },
  error: { bg: 'var(--error-soft)', fg: 'var(--error)', icon: XCircle },
};

export function BannerBar() {
  const isDemoMode = useDemoMode();
  const [dismissed, setDismissed] = useState<Set<string>>(dismissedIds);

  const bannersQuery = useQuery({
    queryKey: ['active-banners'],
    queryFn: listActiveBanners,
    enabled: !isDemoMode,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const banners = (bannersQuery.data ?? []).filter((b) => !dismissed.has(b.id));
  if (banners.length === 0) return null;

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <div className="shrink-0">
      {banners.map((banner) => {
        const style = levelStyle[banner.level] ?? levelStyle.info;
        const Icon = banner.level === 'info' ? Megaphone : style.icon;
        return (
          <div
            key={banner.id}
            className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-2"
            style={{ background: style.bg }}
            role="status"
          >
            <Icon size={14} className="shrink-0" style={{ color: style.fg }} />
            <div className="min-w-0 flex-1">
              <span className="text-[12.5px] font-semibold" style={{ color: style.fg }}>
                {banner.title}
              </span>
              {banner.body ? (
                <span className="ml-2 text-[12px] text-[var(--text-secondary)]">{banner.body}</span>
              ) : null}
            </div>
            {banner.dismissible ? (
              <button
                type="button"
                onClick={() => dismiss(banner.id)}
                className="shrink-0 rounded p-0.5 hover:bg-black/10"
                style={{ color: style.fg }}
                aria-label="Dismiss announcement"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
