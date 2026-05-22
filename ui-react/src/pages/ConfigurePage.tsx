import { useParams } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Configure page — Two-column layout: tree + configuration form.
 * Primary screen for the flattened form workflow (SOW §8 acceptance criterion).
 */
export function ConfigurePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure{id ? ` — ${id}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Configuration form with model tree navigation will be implemented
          here. This will be the single-form workflow replacing the 5-level
          nested modal chain.
        </p>
      </CardContent>
    </Card>
  );
}
