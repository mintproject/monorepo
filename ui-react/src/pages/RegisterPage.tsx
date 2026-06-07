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
          Define a model configuration — its parameters, inputs and outputs. Linking it to a model
          family is optional.
        </p>
      </div>
      <CreateModelForm />
    </div>
  );
}
