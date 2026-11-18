import React from 'react';
import { ShieldCheck, User, LogOut, Wrench } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="h-16 border-b bg-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base tracking-tight text-foreground">
              Repair<span className="text-primary">Proof</span>
            </span>
            <Badge variant="success" className="text-[10px] uppercase font-mono px-1.5 py-0">
              Verified
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {user?.shop?.name || 'Evidence-Driven Repair Lab'}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-foreground font-semibold border">
            {user?.displayName ? user.displayName.charAt(0) : <User className="h-4 w-4" />}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold leading-none">{user?.displayName || 'Technician'}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{user?.role || 'TECHNICIAN'}</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={logout} title="Sign Out">
          <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Button>
      </div>
    </header>
  );
};
