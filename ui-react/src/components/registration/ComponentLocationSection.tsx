/**
 * ComponentLocationSection — where the model configuration's executable component
 * lives.
 *
 * Writes `componentLocation`, which the submit flow stores in
 * `has_component_location`. A model configuration with none is metadata only: the
 * Ensemble Manager has nothing to run.
 *
 * Two modes, as in the legacy UI's model-configuration screen:
 *   Tapis application → pick from the tenant's app catalogue; the stored value
 *                       is the canonical app URL
 *   Any URL           → type any location, such as a component zip
 *
 * The deployment's execution engine picks the starting mode, and the user can
 * switch. The mode is view state only — the stored value is one string either
 * way, so an existing value always decides which mode opens.
 */
import * as React from 'react';
import { useFormContext } from 'react-hook-form';

import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  buildSeedFromTapisApp,
  getTapisTenant,
  parseTapisAppUrl,
  usesTapisComponents,
  type TapisApp,
} from '@/lib/tapis-apps';
import { emptyInputRow, emptyParameterRow } from '@/schemas/configuration';
import type { CreateModelSchema } from '@/schemas/registration';
import { TapisAppPicker } from './TapisAppPicker';

type Mode = 'tapis' | 'url';

/** The mode an existing value belongs to, before the user chooses one. */
function initialMode(value: string, tapisAvailable: boolean): Mode {
  if (parseTapisAppUrl(value)) return 'tapis';
  if (value.trim()) return 'url';
  return tapisAvailable ? 'tapis' : 'url';
}

export function ComponentLocationSection() {
  const { control, getValues, setValue, watch } = useFormContext<CreateModelSchema>();
  const { toast } = useToast();

  const tenant = getTapisTenant();
  const tapisAvailable = usesTapisComponents() && tenant !== null;

  const value = watch('componentLocation') ?? '';
  const [mode, setMode] = React.useState<Mode>(() =>
    initialMode(getValues('componentLocation') ?? '', tapisAvailable),
  );

  const inputCount = watch('inputs')?.length ?? 0;
  const parameterCount = watch('parameters')?.length ?? 0;
  const syncWarning =
    inputCount + parameterCount > 0
      ? `This replaces the ${inputCount} input(s) and ${parameterCount} parameter(s) below.`
      : null;

  /** Replace the model configuration's inputs and parameters with the application's own. */
  const applySeed = (app: TapisApp) => {
    const seed = buildSeedFromTapisApp(app);

    setValue(
      'inputs',
      seed.inputs.map((row, index) => ({
        ...emptyInputRow(index),
        label: row.label,
        description: row.description,
        isOptional: row.isOptional,
      })),
      { shouldDirty: true },
    );
    setValue(
      'parameters',
      seed.parameters.map((row, index) => ({
        ...emptyParameterRow(index),
        label: row.label,
        description: row.description,
        hasDefaultValue: row.hasDefaultValue,
        hasDataType: row.hasDataType,
      })),
      { shouldDirty: true },
    );

    toast({
      title: 'Inputs and parameters filled in',
      description: `${seed.inputs.length} input(s) and ${seed.parameters.length} parameter(s) from ${app.id} ${app.version}. Add a variable to each input so the Datasets step can offer data.`,
    });
  };

  const handleModeChange = (next: string) => {
    setMode(next === 'tapis' ? 'tapis' : 'url');
    // Clearing on a mode switch would throw away a value the other mode cannot
    // express, so the value survives the switch and the user edits or replaces it.
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">Component location</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Where the executable component lives. Leave it empty to describe the model configuration
        only. A model configuration with no component location cannot be run.
      </p>

      {tapisAvailable && (
        <Tabs value={mode} onValueChange={handleModeChange} className="mb-3">
          <TabsList>
            <TabsTrigger value="tapis">Tapis application</TabsTrigger>
            <TabsTrigger value="url">Any URL</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <FormField
        control={control}
        name="componentLocation"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              {tapisAvailable && mode === 'tapis' ? (
                <TapisAppPicker
                  tenant={tenant}
                  value={value}
                  onChange={field.onChange}
                  onSync={applySeed}
                  syncWarning={syncWarning}
                />
              ) : (
                <Input
                  type="url"
                  aria-label="Component location URL"
                  placeholder="https://example.org/components/model.zip"
                  {...field}
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
