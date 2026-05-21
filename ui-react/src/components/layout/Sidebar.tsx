import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

const navItems = [
  { path: '/models', label: 'Models' },
  { path: '/configure', label: 'Configure' },
  { path: '/register', label: 'Register' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-background">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              location.pathname.startsWith(item.path)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
