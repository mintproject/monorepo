import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronRight,
  Database,
  FlaskConical,
  Home,
  Map,
  Variable,
  Workflow,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
}

interface NavSection {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If set, this section is a direct link (no sub-items). */
  href?: string;
  /** Sub-navigation items. */
  items?: { href: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Home',
    icon: Home,
    href: '/',
  },
  {
    label: 'Models',
    icon: FlaskConical,
    items: [
      { href: '/models', label: 'Browse Models' },
      { href: '/models/register', label: 'Register Model' },
    ],
  },
  {
    label: 'Modeling',
    icon: Workflow,
    items: [
      { href: '/modeling', label: 'Overview' },
      {
        href: '/modeling/problem-statements',
        label: 'Problem Statements',
      },
    ],
  },
  {
    label: 'Datasets',
    icon: Database,
    items: [
      { href: '/datasets', label: 'Overview' },
      { href: '/datasets/browse', label: 'Browse' },
      { href: '/datasets/search', label: 'Search' },
      { href: '/datasets/register', label: 'Register' },
      { href: '/datasets/transformations', label: 'Transformations' },
    ],
  },
  {
    label: 'Regions',
    icon: Map,
    items: [
      { href: '/regions', label: 'Overview' },
      { href: '/regions/editor', label: 'Region Editor' },
    ],
  },
  {
    label: 'Variables',
    icon: Variable,
    href: '/variables',
  },
];

export function Sidebar({ collapsed }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-background transition-all duration-200',
        collapsed ? 'w-14' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      <nav className="flex flex-col gap-1 p-2">
        {NAV_SECTIONS.map((section) =>
          section.href ? (
            <DirectLink
              key={section.label}
              section={section}
              collapsed={collapsed}
              active={location.pathname === section.href}
            />
          ) : (
            <SectionGroup
              key={section.label}
              section={section}
              collapsed={collapsed}
              currentPath={location.pathname}
            />
          ),
        )}
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DirectLink({
  section,
  collapsed,
  active,
}: {
  section: NavSection;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = section.icon;
  return (
    <Link
      to={section.href!}
      title={collapsed ? section.label : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{section.label}</span>}
    </Link>
  );
}

function SectionGroup({
  section,
  collapsed,
  currentPath,
}: {
  section: NavSection;
  collapsed: boolean;
  currentPath: string;
}) {
  const Icon = section.icon;
  const isAnyChildActive = section.items?.some((item) =>
    currentPath.startsWith(item.href),
  );

  const [open, setOpen] = useState(isAnyChildActive ?? false);

  if (collapsed) {
    // In collapsed mode, show just the icon and no expansion
    return (
      <button
        type="button"
        title={section.label}
        className={cn(
          'flex items-center justify-center rounded-md p-2 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isAnyChildActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground',
        )}
        aria-label={section.label}
      >
        <Icon className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isAnyChildActive
            ? 'text-foreground'
            : 'text-muted-foreground',
        )}
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
          {section.items?.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'rounded-md px-2 py-1.5 text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                currentPath.startsWith(item.href)
                  ? 'bg-accent/60 text-accent-foreground font-medium'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
