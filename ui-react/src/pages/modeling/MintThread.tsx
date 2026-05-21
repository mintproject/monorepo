import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';


/** Modeling thread detail view. */
export function MintThread() {

  const { id } = useParams<{ id: string }>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>MintThread{id ? ` — ${id}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Modeling thread detail will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
