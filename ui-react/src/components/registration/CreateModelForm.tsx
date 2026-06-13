/**
 * CreateModelForm — config-first single-page model creation.
 * UI terms: Model = Configuration, Model Family = Software, Version = SoftwareVersion.
 *
 * Submit order:
 *   1. (optional) CreateModelFamily → Software + first SoftwareVersion
 *   2. CreateConfiguration with software_version_id (null when standalone)
 *   3. AddConfigurationInput / Output / Parameter for each row
 *   4. AddConfigurationRegion for each selected region
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProvider, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreateConfigurationMutation,
  useCreateModelFamilyMutation,
  useAddConfigurationInputMutation,
  useAddConfigurationOutputMutation,
  useAddConfigurationParameterMutation,
  useAddConfigurationRegionMutation,
} from '@/graphql/generated/graphql';
import { InputOutputSection } from '@/components/configuration/InputOutputSection';
import { ParameterSection } from '@/components/configuration/ParameterSection';
import {
  buildAddInputVariables,
  buildAddOutputVariables,
  buildAddParameterVariables,
  assignPositions,
} from '@/lib/mutation-builder';
import { resolveSubmitPlan } from '@/lib/create-model';
import { generateMintUri } from '@/lib/uri';
import { UPSERT_MODELCATALOG_REGION } from '@/graphql/region-picker';
import {
  createModelSchema,
  emptyCreateModel,
  type CreateModelSchema,
} from '@/schemas/registration';
import { RegionScopeSection } from './RegionScopeSection';
import { OptionalDetailsSection } from './OptionalDetailsSection';

export function CreateModelForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<CreateModelSchema>({
    resolver: zodResolver(createModelSchema),
    defaultValues: emptyCreateModel(),
  });

  const [createModelFamily] = useCreateModelFamilyMutation();
  const [createConfiguration] = useCreateConfigurationMutation();
  const [addInput] = useAddConfigurationInputMutation();
  const [addOutput] = useAddConfigurationOutputMutation();
  const [addParameter] = useAddConfigurationParameterMutation();
  const [addRegion] = useAddConfigurationRegionMutation();
  const [upsertRegion] = useMutation(UPSERT_MODELCATALOG_REGION);

  const onSubmit = async (data: CreateModelSchema) => {
    setSubmitError(null);
    const configurationId = generateMintUri();
    const plan = resolveSubmitPlan(data);

    try {
      if (plan.createFamily) {
        await createModelFamily({ variables: plan.createFamily });
      }

      await createConfiguration({
        variables: {
          id: configurationId,
          label: data.label,
          description: data.description || null,
          softwareVersionId: plan.softwareVersionId,
        },
      });

      await Promise.all(
        assignPositions(data.inputs).map((row) =>
          addInput({ variables: buildAddInputVariables(configurationId, row) }),
        ),
      );
      await Promise.all(
        assignPositions(data.outputs).map((row) =>
          addOutput({ variables: buildAddOutputVariables(configurationId, row) }),
        ),
      );
      await Promise.all(
        assignPositions(data.parameters).map((row) =>
          addParameter({ variables: buildAddParameterVariables(configurationId, row) }),
        ),
      );

      // Region scope: mirror each chosen geographic region into modelcatalog_region
      // (so the junction FK resolves), then link it to this configuration. These
      // writes run after the model already exists, so a region failure must not
      // discard the created model — link best-effort and warn on partial failure.
      if (data.isRegionSpecific && data.regions.length > 0) {
        const results = await Promise.allSettled(
          data.regions.map(async (r) => {
            await upsertRegion({ variables: { id: r.id, label: r.label } });
            await addRegion({ variables: { configurationId, regionId: r.id } });
          }),
        );
        const failed = results.filter((res) => res.status === 'rejected').length;
        if (failed > 0) {
          toast({
            title: 'Some regions were not linked',
            description: `${failed} of ${data.regions.length} region(s) could not be linked. You can add them later from the model page.`,
            variant: 'destructive',
          });
        }
      }

      // NOTE: license, website, and keywords are collected but not yet persisted —
      // no mutation target exists for standalone configs. Tracked as a follow-up.

      toast({ title: 'Model created', description: `${data.label} was created successfully.` });
      navigate(`/models/configure/${encodeURIComponent(configurationId)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Creation failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Create a new model</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define a model configuration — its parameters, inputs and outputs. Linking it to a
                  model family is optional.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Model name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder='e.g. "Modflow · Barton Springs"' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Brief description of this model"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                <RegionScopeSection />
                <Separator />
                <ParameterSection />
                <Separator />
                <InputOutputSection prefix="inputs" allowMultipleVariables />
                <Separator />
                <InputOutputSection prefix="outputs" allowMultipleVariables />
                <Separator />
                <OptionalDetailsSection />

                {submitError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {submitError}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create model
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </FormProvider>
    </div>
  );
}
