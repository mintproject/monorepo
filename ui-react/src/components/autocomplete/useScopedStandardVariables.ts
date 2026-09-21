/**
 * useScopedStandardVariables — the option list for a StandardVariableCombobox.
 *
 * The catalog holds far more standard variables than the thread wizard can act
 * on. At TACC it holds 668, of which 147 are produced by a configuration the
 * Models step lists and 161 are taken as an input or adjusted by a parameter.
 * Offering all 668 lets a user pick a legitimate variable and meet a confident
 * zero one step later, which is the failure mode the map already rejected once
 * for dataset search (monorepo#96).
 *
 * So a scope narrows the list:
 *
 * - `all`       — every standard variable. Registration forms use this: they
 *                 describe a model rather than search one, so no row is a dead
 *                 end. This is the default, and it costs no extra query.
 * - `indicator` — the variables a listed configuration produces (thread
 *                 response_variable_id).
 * - `driver`    — with no selected outcome, the variables a listed
 *                 configuration takes as an input, plus the variables its
 *                 parameters adjust. With an outcome selected, this becomes
 *                 the upstream variables reachable through model and ETL
 *                 transforms, including multi-step chains.
 *
 * The full catalog is loaded only when it is asked for — scope `all`, or a
 * narrowed picker whose user has clicked the widen link. Measured against TACC,
 * gzipped: the full list is 35.8 KB, the indicator list 22.2 KB and the driver
 * list 20.8 KB. Loading the full list eagerly beside a scoped one would more
 * than double the step's cost for a list most users never open.
 */
import { gql, useQuery } from '@apollo/client';
import { useMemo } from 'react';

import {
  useGetDriverVariableOptionsQuery,
  useGetIndicatorVariableOptionsQuery,
  usePrefetchReferenceDataQuery,
} from '@/graphql/generated/graphql';
import type { StandardVariableOption } from './StandardVariableCombobox';
import {
  inferOutcomeDriverOptions,
  type InferenceVariable,
  type VariableTransform,
} from '@/lib/modeling/outcome-driver-inference';

export type StandardVariableScope = 'all' | 'indicator' | 'driver';

interface StandardVariableFields {
  id: string;
  label?: string | null;
  description?: string | null;
}

/**
 * Map a catalog row to a combobox option.
 *
 * Shared so that a scoped list and the full list render identically — a row
 * must not change its label just because it arrived through a different query.
 */
export function toStandardVariableOption(sv: StandardVariableFields): StandardVariableOption {
  return {
    id: sv.id,
    label: sv.label?.trim() || 'Unnamed standard variable',
    description: sv.description?.trim() || (sv.label ? null : `Catalog ID: ${sv.id}`),
  };
}

function byLabel(a: StandardVariableOption, b: StandardVariableOption) {
  return a.label.localeCompare(b.label);
}

function dedupe(rows: Array<StandardVariableFields | null | undefined>): StandardVariableOption[] {
  const byId = new Map<string, StandardVariableOption>();
  for (const sv of rows) {
    if (sv && !byId.has(sv.id)) byId.set(sv.id, toStandardVariableOption(sv));
  }
  return [...byId.values()].sort(byLabel);
}

/**
 * Kept inline until the generated schema includes the MINT ETL and SVO adapter
 * registries. Both are exposed through the same authenticated Apollo client.
 */
export const OutcomeDriverInferenceDocument = gql`
  query GetOutcomeDriverInference {
    modelConfigurations: modelcatalog_configuration(
      where: {
        _or: [
          { software_version_id: { _is_null: false }, _not: { child_configurations: {} } }
          { parent_configuration: { software_version_id: { _is_null: false } } }
        ]
      }
    ) {
      id
      inputs {
        configuration_id
        input_id
        input {
          id
          presentations {
            dataset_specification_id
            presentation_id
            presentation {
              id
              standard_variable {
                id
                label
                description
              }
            }
          }
        }
      }
      outputs {
        configuration_id
        output_id
        output {
          id
          presentations {
            dataset_specification_id
            presentation_id
            presentation {
              id
              standard_variable {
                id
                label
                description
              }
            }
          }
        }
      }
      parameters {
        configuration_id
        parameter_id
        parameter {
          id
          adjusts_variables {
            parameter_id
            variable_id
            variable {
              id
              standard_variable {
                id
                label
                description
              }
            }
          }
        }
      }
    }
    etlProcesses: modelcatalog_etl_process {
      contracts(order_by: [{ role: asc }, { position: asc }]) {
        role
        standard_variable_uri
      }
    }
    adapterTransforms: adapter_transform_spec {
      contracts {
        role
        standard_variable_uri
      }
    }
  }
`;

interface InferenceStandardVariable extends InferenceVariable {
  id: string;
}

interface InferencePresentation {
  presentation?: { standard_variable?: InferenceStandardVariable | null } | null;
}

interface InferenceConfigurationInput {
  input?: { presentations?: InferencePresentation[] | null } | null;
}

interface InferenceConfigurationOutput {
  output?: { presentations?: InferencePresentation[] | null } | null;
}

interface InferenceParameter {
  parameter?: {
    adjusts_variables?: Array<{
      variable?: { standard_variable?: InferenceStandardVariable | null } | null;
    }> | null;
  } | null;
}

interface InferenceModelConfiguration {
  inputs?: InferenceConfigurationInput[] | null;
  outputs?: InferenceConfigurationOutput[] | null;
  parameters?: InferenceParameter[] | null;
}

interface InferenceEtlProcess {
  contracts?: Array<{ role: string; standard_variable_uri?: string | null }> | null;
}

interface OutcomeDriverInferenceData {
  modelConfigurations: InferenceModelConfiguration[];
  etlProcesses: InferenceEtlProcess[];
  adapterTransforms: InferenceEtlProcess[];
}

function presentationVariables(
  presentations: InferencePresentation[] | null | undefined,
): InferenceVariable[] {
  return (presentations ?? [])
    .map((row) => row.presentation?.standard_variable)
    .filter((variable): variable is InferenceVariable => Boolean(variable?.id));
}

function modelTransforms(data: OutcomeDriverInferenceData | undefined): VariableTransform[] {
  return (data?.modelConfigurations ?? []).map((configuration) => {
    const outputs =
      configuration.outputs?.flatMap((row) => presentationVariables(row.output?.presentations)) ??
      [];
    const inputs =
      configuration.inputs?.flatMap((row) => presentationVariables(row.input?.presentations)) ?? [];
    const adjusted =
      configuration.parameters?.flatMap(
        (row) =>
          row.parameter?.adjusts_variables
            ?.map((adjustment) => adjustment.variable?.standard_variable)
            .filter((variable): variable is InferenceVariable => Boolean(variable?.id)) ?? [],
      ) ?? [];
    return { outputs, inputs: [...inputs, ...adjusted] };
  });
}

function contractTransforms(processes: InferenceEtlProcess[] | undefined): VariableTransform[] {
  return (processes ?? []).map((process) => {
    const contracts = process.contracts ?? [];
    const toVariable = (uri: string | null | undefined): InferenceVariable | null => {
      const id = uri?.trim();
      return id ? { id, label: id, description: null } : null;
    };
    return {
      outputs: contracts
        .filter((contract) => contract.role === 'output')
        .map((contract) => toVariable(contract.standard_variable_uri))
        .filter((variable): variable is InferenceVariable => Boolean(variable)),
      inputs: contracts
        .filter((contract) => contract.role === 'input')
        .map((contract) => toVariable(contract.standard_variable_uri))
        .filter((variable): variable is InferenceVariable => Boolean(variable)),
    };
  });
}

export interface ScopedStandardVariables {
  /** Options for the scope. Equals `all` when the scope is `all`. */
  scoped: StandardVariableOption[];
  /** Every standard variable in the catalog. Empty until `loadAll` is set. */
  all: StandardVariableOption[];
  /** True once `all` holds the catalog, so a caller can print its size. */
  allLoaded: boolean;
  loading: boolean;
}

/**
 * @param scope   which list to offer.
 * @param loadAll fetch the full catalog as well. Forced on for scope `all`.
 */
export function useScopedStandardVariables(
  scope: StandardVariableScope = 'all',
  loadAll = false,
  driverOutcomeId?: string | null,
): ScopedStandardVariables {
  const wantAll = scope === 'all' || loadAll;
  const allQ = usePrefetchReferenceDataQuery({ fetchPolicy: 'cache-first', skip: !wantAll });
  const indicatorQ = useGetIndicatorVariableOptionsQuery({
    fetchPolicy: 'cache-first',
    skip: scope !== 'indicator',
  });
  const driverQ = useGetDriverVariableOptionsQuery({
    fetchPolicy: 'cache-first',
    skip: scope !== 'driver',
  });
  const outcomeDriverQ = useQuery<OutcomeDriverInferenceData>(OutcomeDriverInferenceDocument, {
    fetchPolicy: 'cache-first',
    skip: scope !== 'driver' || !driverOutcomeId,
  });

  const all = useMemo(() => dedupe(allQ.data?.modelcatalog_standard_variable ?? []), [allQ.data]);

  const scoped = useMemo(() => {
    if (scope === 'indicator') {
      const rows = indicatorQ.data?.modelcatalog_dataset_specification_presentation ?? [];
      return dedupe(rows.map((r) => r.presentation.standard_variable));
    }
    if (scope === 'driver') {
      const inputs = driverQ.data?.inputs ?? [];
      const adjusted = driverQ.data?.adjusted ?? [];
      const legacy = dedupe([
        ...inputs.map((r) => r.presentation.standard_variable),
        ...adjusted.map((r) => r.variable.standard_variable),
      ]);
      if (!driverOutcomeId || !outcomeDriverQ.data) return legacy;
      return dedupe(
        inferOutcomeDriverOptions(driverOutcomeId, [
          ...modelTransforms(outcomeDriverQ.data),
          ...contractTransforms(outcomeDriverQ.data.etlProcesses),
          ...contractTransforms(outcomeDriverQ.data.adapterTransforms),
        ]),
      );
    }
    return all;
  }, [scope, indicatorQ.data, driverQ.data, outcomeDriverQ.data, driverOutcomeId, all]);

  const scopeLoading =
    (scope === 'indicator' && indicatorQ.loading) ||
    (scope === 'driver' && (driverQ.loading || outcomeDriverQ.loading));

  return {
    scoped,
    all,
    allLoaded: wantAll && !allQ.loading && allQ.data != null,
    loading: (wantAll && allQ.loading) || scopeLoading,
  };
}
