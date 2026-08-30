import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you're looking for doesn't exist."
      action={
        <Button asChild>
          <Link to="/models">Go to Models</Link>
        </Button>
      }
    />
  );
}
