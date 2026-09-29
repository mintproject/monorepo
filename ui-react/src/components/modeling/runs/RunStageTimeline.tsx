import {
  displayStatusLabel,
  statusPillClasses,
  type StageDisplayStatus,
} from '@/lib/modeling/run-status';

export interface RunStageTimelineItem {
  id: string;
  label: string;
  detail: string;
  status: StageDisplayStatus;
}

export function RunStageTimeline({ stages }: { stages: RunStageTimelineItem[] }) {
  return (
    <section
      className="rounded border border-gray-200 bg-white p-3"
      aria-label="Run stages"
      data-testid="run-stage-timeline"
    >
      <div className="mb-3">
        <h4 className="font-semibold text-gray-900">What is happening</h4>
        <p className="text-xs text-gray-500">
          Each stage reports only what the current workflow snapshot confirms.
        </p>
      </div>
      <div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="workflow-stages">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="rounded border border-gray-200 p-3"
              aria-current={
                stage.status === 'running' || stage.status === 'completing' ? 'step' : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-gray-900">{stage.label}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] ${statusPillClasses(stage.status)}`}
                >
                  {displayStatusLabel(stage.status)}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600">{stage.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
