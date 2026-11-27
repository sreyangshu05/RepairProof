import React from 'react';
import { ShieldCheck, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';

export const Navbar: React.FC = () => {
  const { t } = useI18n();
  const { user, logout } = useAuthStore();

  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="truncate font-bold text-base tracking-tight text-foreground">
              Repair<span className="text-primary">Proof</span>
            </span>
            <Badge
              variant="success"
              className="hidden text-[10px] uppercase font-mono px-1.5 py-0 sm:inline-flex"
            >
              Verified
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {user?.shop?.name || 'Evidence-Driven Repair Lab'}
          </p>
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center space-x-2 sm:space-x-4">
        <LanguageSwitcher compact />
        <div className="flex items-center space-x-2 text-sm">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold border">
            {user?.displayName ? user.displayName.charAt(0) : <User className="h-4 w-4" />}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold leading-none">
              {user?.displayName || t('role.technician')}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {user?.role || 'TECHNICIAN'}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label={t('common.signOut')}
          title={t('common.signOut')}
        >
          <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </div>
    </header>
  );
};
