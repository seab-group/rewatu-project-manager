import { NavLink } from 'react-router-dom';
import {
  FileText, FolderKanban, LayoutDashboard, PanelLeftClose, PanelLeftOpen, PieChart, Settings,
} from 'lucide-react';
import { cx, IconButton } from '@/components/ui/primitives';
import { LogoLockup } from '@/components/layout/Logo';

export const NAV = [
  { to: '/', label: 'Portfolio dashboard', short: 'Portfolio', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', short: 'Projects', icon: FolderKanban, end: false },
  { to: '/documents', label: 'Documents', short: 'Documents', icon: FileText, end: false },
  { to: '/reports', label: 'Reports', short: 'Reports', icon: PieChart, end: false },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings, end: false },
];

export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'rw-gradient text-white shadow-raised'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
        >
          {({ isActive }) => (
            <>
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
              {!collapsed ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
              {isActive ? <span className="sr-only">(current page)</span> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-30 hidden flex-col bg-indigo-800 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <div className={cx('flex h-16 shrink-0 items-center border-b border-white/10 px-4', collapsed && 'justify-center px-0')}>
        <LogoLockup collapsed={collapsed} />
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className={cx('border-t border-white/10 p-3', collapsed && 'flex justify-center')}>
        <IconButton
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons'}
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          onClick={onToggle}
          className="text-white/60 hover:bg-white/10 hover:text-white"
        />
      </div>
    </aside>
  );
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-[#1B2430]/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-indigo-800 shadow-pop animate-slide-in-left"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <LogoLockup />
          <IconButton
            label="Close menu"
            icon={PanelLeftClose}
            onClick={onClose}
            className="text-white/60 hover:bg-white/10 hover:text-white"
          />
        </div>
        <SidebarNav collapsed={false} onNavigate={onClose} />
      </div>
    </div>
  );
}
