import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { MobileDrawer, Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Toasts } from '@/components/ui/Toasts';
import { cx } from '@/components/ui/primitives';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-indigo focus:shadow-pop"
      >
        Skip to content
      </a>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className={cx('transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]')}>
        <TopBar onOpenMenu={() => setDrawerOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}

/** Page heading used at the top of every top-level view. */
export function PageHeader({
  title, subtitle, action, breadcrumb,
}: { title: string; subtitle?: string; action?: React.ReactNode; breadcrumb?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-indigo sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm leading-relaxed text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
