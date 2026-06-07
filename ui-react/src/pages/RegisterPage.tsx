/**
 * RegisterPage — /models/register
 *
 * Protected route. Hosts the config-first model creation form.
 */
import { CreateModelForm } from '@/components/registration/CreateModelForm';

export function RegisterPage() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Register Model</h1>
        <p className="text-muted-foreground">
          Add a new model to the MINT catalog by completing all three steps.
        </p>
      </div>
      <CreateModelForm />
    </div>
  );
}
