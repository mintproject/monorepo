import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ExploreDestination } from '@/components/home/explore-destinations';
import { cn } from '@/lib/utils';

interface ExploreCardProps {
  destination: ExploreDestination;
  /** How many things this section holds. Omitted when the count is unavailable. */
  count?: number | undefined;
}

/**
 * One entry point into the catalog. The whole card is the link.
 *
 * Deliberately quiet: the four Explore cards are equal to each other, and the
 * page's emphasis belongs to the Decide panel below them. Colour arrives only
 * on hover and focus.
 */
export function ExploreCard({ destination, count }: ExploreCardProps) {
  const Icon = destination.icon;

  return (
    <Link
      to={destination.href}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground',
        'transition-colors hover:border-foreground/30 hover:bg-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {count.toLocaleString()}
          </span>
        )}
      </span>
      <h3 className="text-sm font-bold">{destination.title}</h3>
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
        {destination.description}
      </p>
      <span className="flex items-center gap-1 text-xs font-medium text-foreground group-hover:underline">
        {destination.action}
        <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
