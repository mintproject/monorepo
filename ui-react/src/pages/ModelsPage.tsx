import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Models page — Model list with tree navigation.
 * Will contain the ModelTree sidebar and model detail panels.
 */
export function ModelsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Models</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Model catalog tree and detail view will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
