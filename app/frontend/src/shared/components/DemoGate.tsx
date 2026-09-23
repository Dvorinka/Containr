import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/**
 * Shown by auth/admin-scoped pages when `?demo=1` is active — the demo only
 * carries sample project/platform data, not real accounts or admin state.
 */
export function DemoRestricted({ feature }: { feature: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="panel max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-primary-soft)]">
          <Sparkles size={22} className="text-[var(--accent-primary)]" />
        </div>
        <p className="text-lg font-semibold text-[var(--text-primary)]">Not part of the demo</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {feature} needs a live Containr session. The demo covers sample projects, services, and platform views only.
        </p>
        <Link to="/projects?demo=1" className="v-btn mt-5 inline-flex">
          Back to demo projects
        </Link>
      </div>
    </div>
  );
}
