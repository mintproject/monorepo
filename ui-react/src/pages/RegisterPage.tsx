/**
 * RegisterPage — /models/register
 *
 * Protected route. Hosts the multi-step model registration wizard:
 *   Software -> Version -> Configuration
 */
import { ModelRegistrationWizard } from '@/components/registration/ModelRegistrationWizard';

export function RegisterPage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Register Model</h1>
        <p className="text-muted-foreground">
          Add a new model to the MINT catalog by completing all three steps.
        </p>
      </div>
      <ModelRegistrationWizard />
    </div>
  );
}
