import { cn } from '@/lib/utils';

/**
 * Simple skeleton loading placeholder.
 * Matches the shadcn/ui Skeleton API without requiring an additional package.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
