import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';


/** Dataset detail page. */
export function DatasetDetail() {

  const { id } = useParams<{ id: string }>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>DatasetDetail{id ? ` — ${id}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Dataset detail view will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
