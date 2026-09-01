import { useState } from 'react';

import { cn } from '@/lib/utils';

import { BrandingStrip } from './BrandingStrip';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // The strip and the footer are siblings of the content row, not of `main`, so
  // the shell keeps owning the viewport height and the scroll container is
  // still `main`. The footer is pinned to the bottom by that layout, not by
  // position: fixed.
  return (
    <div className="flex h-screen flex-col">
      <BrandingStrip />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className={cn('flex-1 overflow-y-auto p-6 transition-all duration-200')}>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
