import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function AppHome() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome to MINT Model Catalog
        </h2>
        <p className="mt-1 text-muted-foreground">
          Register, configure, and explore scientific models.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          title="Browse Models"
          description="Explore the model catalog and select configurations."
          href="/models"
        />
        <QuickLink
          title="Register a Model"
          description="Add a new model to the catalog."
          href="/models/register"
        />
        <QuickLink
          title="Modeling"
          description="Manage problem statements and modeling threads."
          href="/modeling"
        />
        <QuickLink
          title="Datasets"
          description="Browse and register datasets."
          href="/datasets"
        />
        <QuickLink
          title="Regions"
          description="Define and manage geographic regions."
          href="/regions"
        />
        <QuickLink
          title="Variables"
          description="Browse standard variables and units."
          href="/variables"
        />
      </div>
    </div>
  );
}

function QuickLink({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild size="sm" variant="outline">
          <Link to={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
