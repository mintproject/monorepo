import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'react-router-dom';


/** Single problem statement detail view. */
export function MintProblemStatement() {

  const { id } = useParams<{ id: string }>();
  return (
    <Card>
      <CardHeader>
        <CardTitle>MintProblemStatement{id ? ` — ${id}` : ''}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Problem statement detail will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
