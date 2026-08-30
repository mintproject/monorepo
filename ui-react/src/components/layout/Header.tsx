import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/useAuth';

import { cn } from '@/lib/utils';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { isAuthenticated, user, login, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-lg font-semibold leading-none">MINT Model Catalog</span>
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <UserAvatar username={user?.username} />
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.username}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={login}>
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}

/** Simple initials-based avatar when no image is available. */
function UserAvatar({ username }: { username?: string }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : '??';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full',
        'select-none bg-primary text-xs font-medium text-primary-foreground',
      )}
    >
      {initials}
    </span>
  );
}
