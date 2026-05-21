import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Register page — Model registration wizard.
 * Steps: Software metadata → Version metadata → Configuration.
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
