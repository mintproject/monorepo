import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Configure page — Two-column layout: tree + configuration form.
 * This is the primary screen for the flattened form workflow.
 */
export function ConfigurePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Configuration form with model tree navigation will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
