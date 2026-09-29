import { useMemo } from 'react';

export interface RunScalarResult {
  value: number;
  unit?: string;
  operation?: string;
  status?: string;
}

function asScalarResult(value: unknown): RunScalarResult | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Record<string, unknown>;
  if (typeof result.value !== 'number' || !Number.isFinite(result.value)) return null;
  return {
    value: result.value,
    ...(typeof result.unit === 'string' && result.unit.trim() ? { unit: result.unit.trim() } : {}),
    ...(typeof result.operation === 'string' && result.operation.trim()
      ? { operation: result.operation.trim() }
      : {}),
    ...(typeof result.status === 'string' && result.status.trim()
      ? { status: result.status.trim() }
      : {}),
  };
}

interface RunAnswerCardProps {
  result: unknown;
  label?: string;
}

export function RunAnswerCard({ result, label = 'Modeled result' }: RunAnswerCardProps) {
  const scalar = useMemo(() => asScalarResult(result), [result]);
  if (!scalar) return null;

  return (
    <section
      className="rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-950"
      aria-label={label}
      data-testid="run-answer-card"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{scalar.value}</span>
        {scalar.unit && <span className="text-sm text-emerald-800">{scalar.unit}</span>}
      </div>
      {scalar.operation && (
        <div className="mt-1 text-[11px] text-emerald-700">Derived by {scalar.operation}</div>
      )}
    </section>
  );
}
