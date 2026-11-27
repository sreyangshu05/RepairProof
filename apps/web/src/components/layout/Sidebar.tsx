import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  ClipboardList,
  PlusCircle,
  FileBadge2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/catalog';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Repair Cases', to: '/cases', icon: ClipboardList },
  { name: 'New Case', to: '/cases/new', icon: PlusCircle },
  { name: 'Devices', to: '/devices', icon: Smartphone },
  { name: 'Register Device', to: '/devices/register', icon: PlusCircle },
  { name: 'Verify Certificate', to: '/verify', icon: FileBadge2 },
];
const navKey: Record<string, MessageKey> = {
  Dashboard: 'nav.overview',
  'Repair Cases': 'nav.history',
  'New Case': 'nav.newRepair',
  Devices: 'nav.devices',
  'Register Device': 'nav.devices',
  'Verify Certificate': 'nav.certificates',
};

export const Sidebar: React.FC = () => {
  const { t } = useI18n();
  return (
    <>
      <aside className="w-64 border-r bg-card/50 flex flex-col justify-between p-4 hidden md:flex shrink-0">
        <div className="space-y-6">
          <div>
            <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('workspace.technician')}
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{t(navKey[item.name] ?? 'common.na')}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="pt-4 border-t">
            <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t('protocol.label')}
            </p>
            <div className="px-3 py-2.5 rounded-lg bg-secondary/50 border text-xs space-y-2">
              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t('protocol.tamperResistant')}</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {t('protocol.description')}
              </p>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground px-3 py-2 border-t font-mono">
          v0.1.0-alpha • Modular Monolith
        </div>
      </aside>
      <nav
        aria-label="Technician mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/8%)] md:hidden"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.name}
            className={({ isActive }) =>
              cn(
                'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-center text-[9px] font-medium leading-3 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
              )
            }
          >
            <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="w-full break-words">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
