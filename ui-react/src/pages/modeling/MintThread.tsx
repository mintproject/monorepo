/**
 * MintThread — Step workflow container for a modeling sub-task.
 *
 * 1:1 port of the legacy LitElement MintThread component.
 * Provides a breadcrumb navigation bar (Configure → Variables → Models →
 * Datasets → Parameters → Runs → Results → Summary) and renders the
 * appropriate step panel based on the active section.
 *
 * This component loads thread data via Apollo and handles step transitions.
 */
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Thread,
  getUserPermission,
  useGetThreadQuery,
} from '@/graphql/generated/modeling';
import { useAuth } from '@/lib/auth/useAuth';
import { cn } from '@/lib/utils';

import { MintConfigure } from './thread/MintConfigure';
import { MintVariables } from './thread/MintVariables';
import { MintSummary } from './thread/MintSummary';

// ─── Step definitions ──────────────────────────────────────────────────────────

export type ThreadSection =
  | 'configure'
  | 'variables'
  | 'models'
  | 'datasets'
  | 'parameters'
  | 'runs'
  | 'results'
  | 'summary';

interface StepDef {
  id: ThreadSection;
  label: string;
  /** Whether the step is fully implemented (vs placeholder) */
  implemented: boolean;
}

const STEPS: StepDef[] = [
  { id: 'configure', label: 'Configure', implemented: true },
  { id: 'variables', label: 'Variables', implemented: true },
  { id: 'models', label: 'Models', implemented: false },
  { id: 'datasets', label: 'Datasets', implemented: false },
  { id: 'parameters', label: 'Parameters', implemented: false },
  { id: 'runs', label: 'Runs', implemented: false },
  { id: 'results', label: 'Results', implemented: false },
  { id: 'summary', label: 'Summary', implemented: true },
];

// ─── Status helpers ────────────────────────────────────────────────────────────

type StepStatus = 'not_started' | 'in_progress' | 'done';

function getConfigureStatus(thread: Thread): StepStatus {
  if (thread.name && thread.region_id) return 'done';
  return 'not_started';
}

function getVariablesStatus(thread: Thread): StepStatus {
  if (thread.response_variable_id) return 'done';
  return 'not_started';
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  steps: StepDef[];
  currentSection: ThreadSection;
  sectionStatus: Record<ThreadSection, StepStatus>;
  onSelect: (section: ThreadSection) => void;
}

function ThreadBreadcrumb({ steps, currentSection, sectionStatus, onSelect }: BreadcrumbProps) {
  return (
    <nav aria-label="Thread steps" className="flex flex-wrap gap-0 overflow-x-auto">
      {steps.map((step) => {
        const status = sectionStatus[step.id];
        const isActive = step.id === currentSection;
        const isDone = status === 'done';

        return (
          <button
            key={step.id}
            type="button"
            data-testid={`breadcrumb-${step.id}`}
            aria-current={isActive ? 'step' : undefined}
            onClick={() => onSelect(step.id)}
            className={cn(
              'relative flex items-center px-3 py-2 text-xs font-medium transition-colors',
              'border-t border-b border-r first:border-l first:rounded-l last:rounded-r',
              // Chevron arrow effect via right padding
              'after:absolute after:right-0 after:top-0 after:h-full',
              isActive && isDone && 'bg-blue-700 text-white border-blue-700',
              isActive && !isDone && 'bg-blue-600 text-white border-blue-600',
              !isActive && isDone && 'bg-teal-700 text-white border-teal-700 hover:bg-teal-600',
              !isActive && !isDone && 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
            )}
          >
            {isDone && !isActive && (
              <span className="mr-1 text-green-300 font-bold">✓</span>
            )}
            {step.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Step placeholder ──────────────────────────────────────────────────────────

function StepPlaceholder({ name }: { name: string }) {
  return (
    <div className="py-8 text-center text-sm text-gray-400" data-testid={`placeholder-${name}`}>
      <p className="font-medium text-gray-500">{name} step</p>
      <p className="mt-1">This step will be implemented in a subsequent card.</p>
    </div>
  );
}

// ─── MintThread ────────────────────────────────────────────────────────────────

export function MintThread() {
  const { id: threadId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [maximized, setMaximized] = useState(false);
  const [currentSection, setCurrentSection] = useState<ThreadSection>('configure');

  const { data, loading, error, refetch } = useGetThreadQuery({
    variables: { id: threadId! },
    skip: !threadId,
    fetchPolicy: 'cache-and-network',
  });

  const thread = data?.thread_by_pk ?? null;

  const handleThreadUpdated = useCallback(() => {
    void refetch();
  }, [refetch]);

  function buildSectionStatus(t: Thread): Record<ThreadSection, StepStatus> {
    return {
      configure: getConfigureStatus(t),
      variables: getVariablesStatus(t),
      models: 'not_started',
      datasets: 'not_started',
      parameters: 'not_started',
      runs: 'not_started',
      results: 'not_started',
      summary: 'not_started',
    };
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive p-4" role="alert">
        Failed to load thread: {error.message}
      </p>
    );
  }

  if (!thread) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        No sub-task selected or thread not found.
      </p>
    );
  }

  const sectionStatus = buildSectionStatus(thread);
  const perm = getUserPermission(thread.permissions, thread.events, user?.username ?? null);
  void perm; // reserved for future use (conditional edit buttons)

  function renderStep() {
    switch (currentSection) {
      case 'configure':
        return (
          <MintConfigure
            thread={thread!}
            onContinue={() => setCurrentSection('variables')}
            onThreadUpdated={handleThreadUpdated}
          />
        );
      case 'variables':
        return (
          <MintVariables
            thread={thread!}
            onContinue={() => setCurrentSection('models')}
            onThreadUpdated={handleThreadUpdated}
          />
        );
      case 'summary':
        return (
          <MintSummary
            thread={thread!}
          />
        );
      default:
        return <StepPlaceholder name={currentSection} />;
    }
  }

  return (
    <div
      data-testid="mint-thread"
      className={cn(
        'flex flex-col overflow-hidden',
        maximized ? 'fixed inset-0 z-50 bg-white p-4' : 'h-full',
      )}
    >
      {/* Header: breadcrumb + maximize toggle */}
      <div className="flex items-center gap-2 border-b pb-2 mb-0">
        <ThreadBreadcrumb
          steps={STEPS}
          currentSection={currentSection}
          sectionStatus={sectionStatus}
          onSelect={setCurrentSection}
        />
        <button
          type="button"
          aria-label={maximized ? 'Restore size' : 'Maximize'}
          onClick={() => setMaximized((m) => !m)}
          className="ml-auto shrink-0 rounded p-1.5 hover:bg-gray-100 text-gray-500"
        >
          {maximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderStep()}
      </div>
    </div>
  );
}
