import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  ClipboardList,
  PlusCircle,
  FileBadge2,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r bg-card/50 flex flex-col justify-between p-4 hidden md:flex shrink-0">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Technician Workspace
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t">
          <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Verification Protocol
          </p>
          <div className="px-3 py-2.5 rounded-lg bg-secondary/50 border text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Tamper-Resistant</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Every diagnosis, quote change, and repair photo generates an immutable verifiable audit record.
            </p>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground px-3 py-2 border-t font-mono">
        v0.1.0-alpha • Modular Monolith
      </div>
    </aside>
  );
};
