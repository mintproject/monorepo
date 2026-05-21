import { useAuth } from '@/lib/auth/useAuth';
import { Button } from '@/components/ui/button';

export function Header() {
  const { isAuthenticated, user, login, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">MINT Model Catalog</h1>
      </div>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <span className="text-sm text-muted-foreground">{user?.username}</span>
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
