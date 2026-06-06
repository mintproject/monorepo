import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';

/** Datasets associated with a region. */
export function RegionDatasets() {
  const { id } = useParams<{ id: string }>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>RegionDatasets{id ? ` — ${id}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Region datasets will be implemented here.</p>
      </CardContent>
    </Card>
  );
}
