import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Register page — Model registration wizard.
 * Will contain the multi-step wizard: Software → Version → Configuration.
 */
export function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Register Model</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Model registration wizard will be implemented here.
        </p>
      </CardContent>
    </Card>
  );
}
