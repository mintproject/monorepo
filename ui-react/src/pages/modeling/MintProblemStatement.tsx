import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  FileText,
  FilePlus,
  FolderPlus,
  Lock,
  Pencil,
  Trash2,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/useAuth';
import { provisionTask } from '@/lib/modeling/provisionTask';
import { EmptyState } from '@/components/common/EmptyState';

import {
  useGetProblemStatementQuery,
  useInsertTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useInsertTaskProvenanceMutation,
  useInsertThreadMutation,
  useInsertThreadProvenanceMutation,
  useDeleteThreadMutation,
  getUserPermission,
  getLatestEvent,
  generateModelingId,
  type Task,
  type Thread,
  type ProblemStatement,
} from '@/graphql/generated/modeling';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskWithThreads = Task & { threads: Thread[] };
type PSWithTasks = ProblemStatement & { tasks: TaskWithThreads[] };

interface TaskForm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  regionId: string;
}

interface ThreadForm {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

const EMPTY_TASK_FORM: TaskForm = {
  id: '',
  name: '',
  startDate: '2000-01-01',
  endDate: new Date().toISOString().split('T')[0] ?? '',
  regionId: '',
};

const EMPTY_THREAD_FORM: ThreadForm = {
  id: '',
  name: '',
  startDate: '2000-01-01',
  endDate: new Date().toISOString().split('T')[0] ?? '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  return iso ? (iso.split('T')[0] ?? '') : '';
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** A sub-task (thread) has a model when at least one thread_model is selected. */
function threadHasModel(thread: Pick<Thread, 'thread_models'>): boolean {
  return (thread.thread_models?.length ?? 0) > 0;
}

/** Small emerald/amber dot signalling whether a sub-task has a model selected. */
function StatusDot({ active, title }: { active: boolean; title: string }) {
  return (
    <span
      role="status"
      aria-label={title}
      title={title}
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        active ? 'bg-emerald-500' : 'bg-amber-400',
      )}
    />
  );
}

/**
 * MintProblemStatement — master-detail view for a single problem statement.
 *
 * Left panel: list of tasks with expandable thread sub-list.
 * Right panel: MintThread (placeholder — linked by route navigation).
 *
 * Layout mirrors the legacy LitElement component's two-column design.
 */
export function MintProblemStatement() {
  const { id: problemStatementId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── data ──────────────────────────────────────────────────────────────────
  const { data, loading, error, refetch } = useGetProblemStatementQuery({
    variables: { id: problemStatementId! },
    skip: !problemStatementId,
    fetchPolicy: 'cache-and-network',
  });

  const ps = data?.problem_statement_by_pk as PSWithTasks | undefined | null;

  // ── local state ───────────────────────────────────────────────────────────
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(EMPTY_TASK_FORM);
  const [savingTask, setSavingTask] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);

  // Thread dialog
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [threadForm, setThreadForm] = useState<ThreadForm>(EMPTY_THREAD_FORM);
  const [savingThread, setSavingThread] = useState(false);
  const [deleteThreadTarget, setDeleteThreadTarget] = useState<Thread | null>(null);

  // ── mutations ─────────────────────────────────────────────────────────────
  const [insertTask] = useInsertTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const [insertTaskProvenance] = useInsertTaskProvenanceMutation();
  const [insertThread] = useInsertThreadMutation();
  const [insertThreadProvenance] = useInsertThreadProvenanceMutation();
  const [deleteThread] = useDeleteThreadMutation();

  // ── derived ───────────────────────────────────────────────────────────────
  const psPerm = getUserPermission(ps?.permissions, ps?.events, user?.username);

  const tasks: TaskWithThreads[] = (ps?.tasks ?? []).slice().sort((a, b) => {
    const ta = getLatestEvent(a.events)?.timestamp ?? '';
    const tb = getLatestEvent(b.events)?.timestamp ?? '';
    return ta < tb ? 1 : -1;
  });

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const threads: Thread[] = (selectedTask?.threads ?? []).slice().sort((a, b) => {
    const ta = getLatestEvent(a.events)?.timestamp ?? '';
    const tb = getLatestEvent(b.events)?.timestamp ?? '';
    return ta < tb ? 1 : -1;
  });

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  // ── task form helpers ─────────────────────────────────────────────────────
  function openAddTaskDialog() {
    setTaskForm({
      ...EMPTY_TASK_FORM,
      startDate: fmtDate(ps?.start_date) || '2000-01-01',
      endDate: fmtDate(ps?.end_date) || (new Date().toISOString().split('T')[0] ?? ''),
      regionId: ps?.region_id ?? '',
    });
    setTaskDialogOpen(true);
  }

  function openEditTaskDialog(task: Task) {
    setTaskForm({
      id: task.id,
      name: task.name,
      startDate: fmtDate(task.start_date),
      endDate: fmtDate(task.end_date),
      regionId: task.region_id ?? '',
    });
    setTaskDialogOpen(true);
  }

  async function handleSaveTask() {
    if (!taskForm.name.trim()) {
      toast({ title: 'Task name is required', variant: 'destructive' });
      return;
    }
    if (taskForm.startDate >= taskForm.endDate) {
      toast({ title: 'Start date must be before end date', variant: 'destructive' });
      return;
    }

    setSavingTask(true);
    try {
      const isEdit = !!taskForm.id;
      if (isEdit) {
        await updateTask({
          variables: {
            id: taskForm.id,
            name: taskForm.name.trim(),
            startDate: taskForm.startDate,
            endDate: taskForm.endDate,
            regionId: taskForm.regionId || null,
          },
        });
        if (user?.username) {
          await insertTaskProvenance({
            variables: {
              taskId: taskForm.id,
              event: 'UPDATE',
              userid: user.username,
            },
          });
        }
        toast({ title: 'Task updated' });
      } else {
        // Create the task + its default thread (+ CREATE provenance for each)
        // via the shared bootstrap used by the auto-provision path.
        const { taskId, threadId } = await provisionTask(
          { insertTask, insertTaskProvenance, insertThread, insertThreadProvenance },
          {
            problemStatementId: problemStatementId!,
            taskName: taskForm.name.trim(),
            startDate: taskForm.startDate,
            endDate: taskForm.endDate,
            regionId: taskForm.regionId || null,
            userId: user?.username,
          },
        );
        toast({ title: 'Task created' });
        setSelectedTaskId(taskId);
        setSelectedThreadId(threadId);
        navigate(`/modeling/thread/${threadId}`);
      }
      setTaskDialogOpen(false);
      setTaskForm(EMPTY_TASK_FORM);
      await refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSavingTask(false);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTaskTarget) return;
    try {
      await deleteTask({ variables: { id: deleteTaskTarget.id } });
      toast({ title: 'Task deleted' });
      if (selectedTaskId === deleteTaskTarget.id) {
        setSelectedTaskId(null);
        setSelectedThreadId(null);
      }
      await refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    } finally {
      setDeleteTaskTarget(null);
    }
  }

  // ── thread form helpers ───────────────────────────────────────────────────
  function openAddThreadDialog() {
    if (!selectedTask) return;
    setThreadForm({
      id: '',
      name: '',
      startDate: fmtDate(selectedTask.start_date),
      endDate: fmtDate(selectedTask.end_date),
    });
    setThreadDialogOpen(true);
  }

  function openEditThreadDialog(thread: Thread) {
    setThreadForm({
      id: thread.id,
      name: thread.name ?? '',
      startDate: fmtDate(thread.start_date),
      endDate: fmtDate(thread.end_date),
    });
    setThreadDialogOpen(true);
  }

  async function handleSaveThread() {
    if (!selectedTask) return;
    if (threadForm.startDate >= threadForm.endDate) {
      toast({ title: 'Start date must be before end date', variant: 'destructive' });
      return;
    }

    setSavingThread(true);
    try {
      // Thread editing (name/dates) is handled as insert-or-update
      // For simplicity we only support creating new threads from this dialog
      // Editing an existing thread's name is straightforward but requires
      // an update_thread_by_pk mutation — kept minimal for this 1:1 port scope
      const isNewThread = !threadForm.id;
      const newId = threadForm.id || generateModelingId('thread');
      await insertThread({
        variables: {
          id: newId,
          name: threadForm.name.trim() || null,
          taskId: selectedTask.id,
          startDate: threadForm.startDate,
          endDate: threadForm.endDate,
          regionId: selectedTask.region_id ?? null,
        },
      });
      // New threads need a CREATE provenance row to be visible to their
      // creator (thread SELECT permission filters on events/permissions).
      if (isNewThread && user?.username) {
        await insertThreadProvenance({
          variables: {
            threadId: newId,
            event: 'CREATE',
            userid: user.username,
            notes: null,
          },
        });
      }
      toast({ title: 'Sub-task created' });
      setSelectedThreadId(newId);
      setThreadDialogOpen(false);
      setThreadForm(EMPTY_THREAD_FORM);
      await refetch();
      navigate(`/modeling/thread/${newId}`);
    } catch (err) {
      console.error(err);
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSavingThread(false);
    }
  }

  async function handleDeleteThread() {
    if (!deleteThreadTarget) return;
    try {
      await deleteThread({ variables: { id: deleteThreadTarget.id } });
      toast({ title: 'Sub-task deleted' });
      if (selectedThreadId === deleteThreadTarget.id) {
        setSelectedThreadId(null);
      }
      await refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    } finally {
      setDeleteThreadTarget(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Failed to load problem statement: {error.message}
      </p>
    );
  }

  if (!ps) {
    return (
      <EmptyState
        title="Problem statement not found"
        description="It may have been deleted, or you may not have access to it."
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b px-1 pb-2 text-sm text-muted-foreground">
        <Link
          to="/modeling/problem-statements"
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Problem Statements
        </Link>
        <span>&rsaquo;</span>
        <span className="max-w-xs truncate font-medium text-foreground">
          {ps.name ?? 'Unnamed'}
        </span>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-1 overflow-hidden rounded-lg border">
        {/* Left panel — tasks + threads */}
        <div className="flex w-72 shrink-0 flex-col border-r">
          <div className="flex-1 overflow-y-auto">
            {/* Help text */}
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Several modeling tasks can be created for a given problem statement. Each task can
              have multiple sub-tasks.
            </p>

            {/* Task list */}
            <ul className="mt-1" role="tree" aria-label="Tasks">
              {tasks.map((task) => {
                const isSelected = task.id === selectedTaskId;
                const taskPerm = getUserPermission(task.permissions, task.events, user?.username);
                const lastEvent = getLatestEvent(task.events);

                return (
                  <li
                    key={task.id}
                    role="treeitem"
                    aria-selected={isSelected}
                    aria-expanded={isSelected}
                  >
                    {/* Task row */}
                    <div
                      className={cn(
                        'group flex cursor-pointer items-start gap-2 px-3 py-2 transition-colors',
                        isSelected
                          ? 'bg-accent font-semibold text-accent-foreground'
                          : 'hover:bg-muted/50',
                      )}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTaskId(null);
                          setSelectedThreadId(null);
                        } else {
                          setSelectedTaskId(task.id);
                          setSelectedThreadId(null);
                        }
                      }}
                    >
                      {/* Folder icon */}
                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                        {isSelected ? (
                          <FolderOpen className="h-4 w-4" />
                        ) : (
                          <Folder className="h-4 w-4" />
                        )}
                      </span>

                      {/* Task name + meta */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm leading-snug">{task.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {fmtDate(task.start_date)} – {fmtDate(task.end_date)}
                        </p>
                        {lastEvent && (
                          <p className="text-xs text-muted-foreground/70">
                            {lastEvent.userid} · {fmtDateTime(lastEvent.timestamp)}
                          </p>
                        )}
                      </div>

                      {/* Action icons */}
                      <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                        {taskPerm.write ? (
                          <button
                            type="button"
                            aria-label={`Edit task ${task.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTaskDialog(task);
                            }}
                            className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {taskPerm.owner && (
                          <button
                            type="button"
                            aria-label={`Delete task ${task.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTaskTarget(task);
                            }}
                            className="rounded p-0.5 hover:bg-muted hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-task (thread) list — expanded when task is selected */}
                    {isSelected && (
                      <ul className="ml-8" role="group">
                        {threads.map((thread, i) => {
                          const isThreadSelected = thread.id === selectedThreadId;
                          const threadPerm = getUserPermission(
                            thread.permissions,
                            thread.events,
                            user?.username,
                          );
                          const pname =
                            thread.name ?? `Default sub-task ${i === 0 ? '' : i + 1}`.trim();
                          const threadLastEvent = getLatestEvent(thread.events);

                          return (
                            <li
                              key={thread.id}
                              role="treeitem"
                              aria-selected={isThreadSelected}
                              className={cn(
                                'group flex cursor-pointer items-start gap-2 px-3 py-2 transition-colors',
                                isThreadSelected
                                  ? 'bg-accent/60 font-medium text-accent-foreground'
                                  : 'hover:bg-muted/40',
                              )}
                              tabIndex={0}
                              onClick={() => setSelectedThreadId(thread.id)}
                              onDoubleClick={() => navigate(`/modeling/thread/${thread.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  navigate(`/modeling/thread/${thread.id}`);
                                } else if (e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedThreadId(thread.id);
                                }
                              }}
                            >
                              <span className="mt-0.5 shrink-0 text-muted-foreground">
                                {isThreadSelected ? (
                                  <FileText className="h-3.5 w-3.5" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5 opacity-60" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1.5 truncate text-sm">
                                  <StatusDot
                                    active={threadHasModel(thread)}
                                    title={
                                      threadHasModel(thread) ? 'Model selected' : 'No model yet'
                                    }
                                  />
                                  {pname}
                                </p>
                                {threadLastEvent && (
                                  <p className="text-xs text-muted-foreground/70">
                                    {threadLastEvent.userid} ·{' '}
                                    {fmtDateTime(threadLastEvent.timestamp)}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                                {threadPerm.write ? (
                                  <button
                                    type="button"
                                    aria-label={`Edit sub-task ${pname}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditThreadDialog(thread);
                                    }}
                                    className="rounded p-0.5 hover:bg-muted"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {threadPerm.owner && (
                                  <button
                                    type="button"
                                    aria-label={`Delete sub-task ${pname}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteThreadTarget(thread);
                                    }}
                                    className="rounded p-0.5 hover:bg-muted hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}

                        {/* Create new sub-task */}
                        {selectedTask &&
                          getUserPermission(
                            selectedTask.permissions,
                            selectedTask.events,
                            user?.username,
                          ).write && (
                            <li>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAddThreadDialog();
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              >
                                <FilePlus className="h-3.5 w-3.5" />
                                Create new sub-task
                              </button>
                            </li>
                          )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Add new task */}
          <div className="border-t p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={openAddTaskDialog}
              disabled={!psPerm.write}
            >
              {psPerm.write ? <FolderPlus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Add new task
            </Button>
          </div>
        </div>

        {/* Right panel — adaptive: thread summary (A) when a sub-task is
            selected, otherwise a problem-statement overview (C). */}
        <div className="flex-1 overflow-auto p-6">
          {selectedThread ? (
            <ThreadSummaryPanel
              thread={selectedThread}
              onOpen={() => navigate(`/modeling/thread/${selectedThread.id}`)}
            />
          ) : (
            <ProblemOverviewPanel tasks={tasks} />
          )}
        </div>
      </div>

      {/* ── Task dialog ────────────────────────────────────────────────────── */}
      <TaskDialog
        open={taskDialogOpen}
        isEdit={!!taskForm.id}
        form={taskForm}
        saving={savingTask}
        onChange={(f, v) => setTaskForm((prev) => ({ ...prev, [f]: v }))}
        onSubmit={handleSaveTask}
        onCancel={() => {
          setTaskDialogOpen(false);
          setTaskForm(EMPTY_TASK_FORM);
        }}
      />

      {/* ── Delete task confirmation ───────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTaskTarget}
        onOpenChange={(open) => !open && setDeleteTaskTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTaskTarget?.name}&quot; and all its
              sub-tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Thread dialog ──────────────────────────────────────────────────── */}
      <ThreadDialog
        open={threadDialogOpen}
        isEdit={!!threadForm.id}
        form={threadForm}
        saving={savingThread}
        onChange={(f, v) => setThreadForm((prev) => ({ ...prev, [f]: v }))}
        onSubmit={handleSaveThread}
        onCancel={() => {
          setThreadDialogOpen(false);
          setThreadForm(EMPTY_THREAD_FORM);
        }}
      />

      {/* ── Delete thread confirmation ────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteThreadTarget}
        onOpenChange={(open) => !open && setDeleteThreadTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sub-task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this sub-task and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Right panel: thread summary (A) ──────────────────────────────────────────

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function ThreadSummaryPanel({ thread, onOpen }: { thread: Thread; onOpen: () => void }) {
  const configs = (thread.thread_models ?? [])
    .map((m) => m.modelcatalog_configuration?.label)
    .filter((l): l is string => !!l);
  const lastEvent = getLatestEvent(thread.events);
  const hasModel = threadHasModel(thread);
  const title = thread.name ?? 'Default sub-task';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot active={hasModel} title={hasModel ? 'Model selected' : 'No model yet'} />
            <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(thread.start_date)} – {fmtDate(thread.end_date)}
          </p>
        </div>
        <Button onClick={onOpen} className="shrink-0 gap-1.5">
          Open thread
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 text-sm">
          <SummaryRow label="Model">
            {configs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {configs.map((c, i) => (
                  <Badge key={i} variant="secondary">
                    {c}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">No model selected yet</span>
            )}
          </SummaryRow>
          <SummaryRow label="Response variable">
            {thread.response_variable?.name ?? <span className="text-muted-foreground">—</span>}
          </SummaryRow>
          <SummaryRow label="Driving variable">
            {thread.driving_variable?.name ?? <span className="text-muted-foreground">—</span>}
          </SummaryRow>
          <SummaryRow label="Last activity">
            {lastEvent ? (
              `${lastEvent.userid} · ${fmtDateTime(lastEvent.timestamp)}`
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </SummaryRow>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dataset and run status are shown inside the thread — open it to view or edit them.
      </p>
    </div>
  );
}

// ─── Right panel: problem overview (C) ────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ProblemOverviewPanel({ tasks }: { tasks: TaskWithThreads[] }) {
  const taskCount = tasks.length;
  const allThreads = tasks.flatMap((t) => t.threads ?? []);
  const subtaskCount = allThreads.length;
  const withModel = allThreads.filter((t) => threadHasModel(t)).length;
  const empty = subtaskCount - withModel;

  type Activity = {
    kind: string;
    name: string;
    event: { event: string; timestamp: string; userid: string } | null;
  };
  const activity = (
    [
      ...tasks.map((t) => ({ kind: 'Task', name: t.name, event: getLatestEvent(t.events) })),
      ...allThreads.map((t) => ({
        kind: 'Sub-task',
        name: t.name ?? 'Default sub-task',
        event: getLatestEvent(t.events),
      })),
    ] as Activity[]
  )
    .filter((a): a is Activity & { event: NonNullable<Activity['event']> } => a.event !== null)
    .sort((a, b) => (a.event.timestamp < b.event.timestamp ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tasks" value={taskCount} />
        <StatCard label="Sub-tasks" value={subtaskCount} />
        <StatCard label={`with a model · ${empty} empty`} value={withModel} />
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{a.kind}:</span> {a.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {a.event.event} · {fmtDateTime(a.event.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Select a sub-task to see its model summary, or double-click to open it.
      </p>
    </div>
  );
}

// ─── Task dialog ──────────────────────────────────────────────────────────────

interface TaskDialogProps {
  open: boolean;
  isEdit: boolean;
  form: TaskForm;
  saving: boolean;
  onChange: (field: keyof TaskForm, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function TaskDialog({ open, isEdit, form, saving, onChange, onSubmit, onCancel }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'Add new task'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="task-name">Task name</Label>
            <Input
              id="task-name"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Flooding effect on crop production"
              required
            />
          </div>
          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Adjust time period (optional)
            </summary>
            <p className="mt-1 text-xs text-muted-foreground">
              Inherited from the problem statement. Change only if this task covers a different
              period.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="date"
                id="task-start"
                value={form.startDate}
                onChange={(e) => onChange('startDate', e.target.value)}
                aria-label="Start date"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                id="task-end"
                value={form.endDate}
                onChange={(e) => onChange('endDate', e.target.value)}
                aria-label="End date"
                className="flex-1"
              />
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Thread dialog ────────────────────────────────────────────────────────────

interface ThreadDialogProps {
  open: boolean;
  isEdit: boolean;
  form: ThreadForm;
  saving: boolean;
  onChange: (field: keyof ThreadForm, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function ThreadDialog({
  open,
  isEdit,
  form,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: ThreadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit sub-task' : 'Create new sub-task'}</DialogTitle>
        </DialogHeader>
        {!isEdit && (
          <p className="text-sm text-muted-foreground">
            A sub-task lets you investigate different initial conditions or different models within
            this task.
          </p>
        )}
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="thread-name">Sub-task name (optional)</Label>
            <Input
              id="thread-name"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="Leave blank for default sub-task"
            />
          </div>
          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Adjust time period (optional)
            </summary>
            <p className="mt-1 text-xs text-muted-foreground">
              Inherited from the task. Change only if this sub-task covers a different period.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="date"
                id="thread-start"
                value={form.startDate}
                onChange={(e) => onChange('startDate', e.target.value)}
                aria-label="Start date"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                id="thread-end"
                value={form.endDate}
                onChange={(e) => onChange('endDate', e.target.value)}
                aria-label="End date"
                className="flex-1"
              />
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create sub-task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
