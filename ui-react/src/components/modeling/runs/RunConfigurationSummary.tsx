interface RunConfigurationSummaryProps {
  inputResources: number;
  parameterCombinations: number;
  outputsPerRun: number;
}

export function RunConfigurationSummary({
  inputResources,
  parameterCombinations,
  outputsPerRun,
}: RunConfigurationSummaryProps) {
  return (
    <section className="rounded border border-gray-200 bg-white p-3" aria-label="Run configuration">
      <h4 className="font-semibold text-gray-900">Run configuration</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Input resources</dt>
          <dd className="font-semibold text-gray-900">{inputResources}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Parameter combinations</dt>
          <dd className="font-semibold text-gray-900">{parameterCombinations}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Outputs per run</dt>
          <dd className="font-semibold text-gray-900">{outputsPerRun}</dd>
        </div>
      </dl>
    </section>
  );
}
