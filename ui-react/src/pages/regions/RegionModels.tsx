import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';

/** Models associated with a region. */
export function RegionModels() {
  const { id } = useParams<{ id: string }>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>RegionModels{id ? ` — ${id}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Region models will be implemented here.</p>
      </CardContent>
    </Card>
  );
}
