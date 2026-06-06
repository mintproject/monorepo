/**
 * ModelRegistrationWizard — Multi-step wizard for registering new models.
 *
 * Steps:
 *   1. SoftwareStep   — Software metadata (label, type, description, keywords, license, website)
 *   2. VersionStep    — Version metadata (versionId, label, description, usage notes, source code URL)
 *   3. ConfigurationStep — Configuration + inputs/outputs/parameters (flattened form)
 *
 * Navigation: per-step Zod validation before advancing. Final submit is atomic:
 * RegisterModel mutation creates Software + Version + Configuration in one call,
 * then AddConfigurationInput/Output/Parameter calls create the I/O rows.
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §5.6
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import {
  useRegisterModelMutation,
  useAddConfigurationInputMutation,
  useAddConfigurationOutputMutation,
  useAddConfigurationParameterMutation,
} from '@/graphql/generated/graphql';
import {
  softwareStepSchema,
  versionStepSchema,
  emptySoftwareStep,
  emptyVersionStep,
  type SoftwareStepSchema,
  type VersionStepSchema,
} from '@/schemas/registration';
import {
  configurationFormSchema,
  type ConfigurationFormSchema,
} from '@/schemas/configuration';
import {
  buildAddInputVariables,
  buildAddOutputVariables,
  buildAddParameterVariables,
  assignPositions,
} from '@/lib/mutation-builder';
import { generateMintUri } from '@/lib/uri';

import { SoftwareStep } from './SoftwareStep';
import { VersionStep } from './VersionStep';
import { ConfigurationStep } from './ConfigurationStep';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 'software', label: 'Software', description: 'Model metadata' },
  { id: 'version', label: 'Version', description: 'Version details' },
  { id: 'configuration', label: 'Configuration', description: 'Inputs & outputs' },
] as const;

// ─── Wizard step indicator ────────────────────────────────────────────────────

interface StepIndicatorProps {
  steps: typeof STEPS;
  currentStep: number;
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Registration steps" className="mb-8">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-2 border-primary bg-background text-primary'
                        : 'border-2 border-muted bg-background text-muted-foreground',
                  ].join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-1 text-center">
                  <p
                    className={[
                      'text-xs font-medium',
                      isCurrent ? 'text-primary' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={[
                    'mx-3 h-0.5 w-16 flex-shrink-0',
                    isCompleted ? 'bg-primary' : 'bg-muted',
                  ].join(' ')}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function ModelRegistrationWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track which step we're on (0-indexed)
  const [currentStep, setCurrentStep] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // ─── Per-step forms ────────────────────────────────────────────────────────
  // Each step owns its own form instance with per-step validation.
  // Collected data is merged at submit time.

  const softwareForm = useForm<SoftwareStepSchema>({
    resolver: zodResolver(softwareStepSchema),
    defaultValues: emptySoftwareStep(),
  });

  const versionForm = useForm<VersionStepSchema>({
    resolver: zodResolver(versionStepSchema),
    defaultValues: emptyVersionStep(),
  });

  const configForm = useForm<ConfigurationFormSchema>({
    resolver: zodResolver(configurationFormSchema),
    defaultValues: {
      label: '',
      description: '',
      inputs: [],
      outputs: [],
      parameters: [],
      authors: [],
      regions: [],
    },
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────
  const [registerModel, { loading: registering }] = useRegisterModelMutation();
  const [addInput] = useAddConfigurationInputMutation();
  const [addOutput] = useAddConfigurationOutputMutation();
  const [addParameter] = useAddConfigurationParameterMutation();

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  /**
   * Validate the current step's form and advance if valid.
   * On the last step, submit the entire wizard.
   */
  const handleNext = async () => {
    setSubmitError(null);

    if (currentStep === 0) {
      const valid = await softwareForm.trigger();
      if (valid) setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      const valid = await versionForm.trigger();
      if (valid) setCurrentStep(2);
      return;
    }

    // Step 2 — final submit
    const configValid = await configForm.trigger();
    if (!configValid) return;

    await handleSubmit();
  };

  // ─── Final submit ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const softwareData = softwareForm.getValues();
    const versionData = versionForm.getValues();
    const configData = configForm.getValues();

    const softwareId = generateMintUri();
    const versionId = generateMintUri();
    const configurationId = generateMintUri();

    try {
      // 1. Create Software + Version + Configuration in a single mutation
      await registerModel({
        variables: {
          softwareId,
          softwareLabel: softwareData.label,
          softwareDescription: softwareData.description || undefined,
          softwareType: softwareData.type,
          versionId,
          versionLabel: versionData.label,
          versionVersionId: versionData.versionId || undefined,
          versionDescription: versionData.description || undefined,
          configurationId,
          configurationLabel: configData.label,
          configurationDescription: configData.description || undefined,
        },
      });

      // 2. Add inputs
      const inputsWithPos = assignPositions(configData.inputs);
      await Promise.all(
        inputsWithPos.map((row) =>
          addInput({
            variables: buildAddInputVariables(configurationId, row),
          })
        )
      );

      // 3. Add outputs
      const outputsWithPos = assignPositions(configData.outputs);
      await Promise.all(
        outputsWithPos.map((row) =>
          addOutput({
            variables: buildAddOutputVariables(configurationId, row),
          })
        )
      );

      // 4. Add parameters
      const paramsWithPos = assignPositions(configData.parameters);
      await Promise.all(
        paramsWithPos.map((row) =>
          addParameter({
            variables: buildAddParameterVariables(configurationId, row),
          })
        )
      );

      toast({
        title: 'Model registered',
        description: `${softwareData.label} has been registered successfully.`,
      });

      // Navigate to the configure page for the new configuration
      navigate(`/models/configure/${encodeURIComponent(configurationId)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setSubmitError(message);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep]?.label ?? ''}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {STEPS[currentStep]?.description ?? ''}
          </p>
        </CardHeader>
        <CardContent>
          {/* Step 0: Software */}
          {currentStep === 0 && (
            <FormProvider {...softwareForm}>
              <Form {...softwareForm}>
                <SoftwareStep />
              </Form>
            </FormProvider>
          )}

          {/* Step 1: Version */}
          {currentStep === 1 && (
            <FormProvider {...versionForm}>
              <Form {...versionForm}>
                <VersionStep />
              </Form>
            </FormProvider>
          )}

          {/* Step 2: Configuration */}
          {currentStep === 2 && (
            <FormProvider {...configForm}>
              <Form {...configForm}>
                <ConfigurationStep />
              </Form>
            </FormProvider>
          )}

          {/* Error display */}
          {submitError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isFirstStep || registering}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={registering}
            >
              {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLastStep ? 'Register Model' : 'Next'}
              {!isLastStep && <ChevronRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
