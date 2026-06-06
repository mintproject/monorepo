import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Plus, Search, X, ClipboardList } from 'lucide-react';

import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

import { useAuth } from '@/lib/auth/useAuth';

import {
  useListProblemStatementsQuery,
  useInsertProblemStatementMutation,
  useUpdateProblemStatementMutation,
  useDeleteProblemStatementMutation,
  useInsertProblemStatementProvenanceMutation,
  getUserPermission,
  getLatestEvent,
  getLatestEventOfType,
  generateModelingId,
  type ProblemStatement,
} from '@/graphql/generated/modeling';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormValues {
  id: string;
  name: string;
  regionId: string;
  startDate: string;
  endDate: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  id: '',
  name: '',
  regionId: '',
  startDate: '2000-01-01',
  endDate: new Date().toISOString().split('T')[0] ?? '',
  notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return iso.split('T')[0] ?? '';
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ─── Region types ─────────────────────────────────────────────────────────────

interface TopRegion {
  id: string;
  name: string;
}

interface ListTopRegionsData {
  region: TopRegion[];
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ProblemStatementsListProps {
  /** Region ID to scope the list (required — same as legacy). */
  regionId?: string;
}

/**
 * ProblemStatementsList — lists all problem statements for the selected region.
 * Supports create, edit, delete, and free-text search. Permission-gated
 * edit/delete icons match the legacy LitElement component exactly.
 */
export function ProblemStatementsList({ regionId = 'DEFAULT' }: ProblemStatementsListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── regions ─────────────────────────────────────────────────────────────────
  // problem_statement.region_id is a FK to the region table, so we must scope
  // the list to (and create against) a region that actually exists. The legacy
  // placeholder 'DEFAULT' is not a real region and caused FK violations.
  const { data: regionsData } = useQuery<ListTopRegionsData>(LIST_TOP_REGIONS);
  const regions = useMemo(() => regionsData?.region ?? [], [regionsData]);

  const [selectedRegionId, setSelectedRegionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedRegionId && regions.length > 0) {
      // Honour the requested region when it exists, otherwise fall back to the
      // first available region instead of the bogus 'DEFAULT'.
      const initial = regions.find((r) => r.id === regionId)?.id ?? regions[0]?.id;
      if (initial) setSelectedRegionId(initial);
    }
  }, [regions, selectedRegionId, regionId]);

  // ── data ──────────────────────────────────────────────────────────────────
  const { data, loading, error, refetch } = useListProblemStatementsQuery({
    variables: { regionId: selectedRegionId ?? '' },
    skip: !selectedRegionId,
    fetchPolicy: 'cache-and-network',
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const [insertPS] = useInsertProblemStatementMutation();
  const [updatePS] = useUpdateProblemStatementMutation();
  const [deletePS] = useDeleteProblemStatementMutation();
  const [insertProvenance] = useInsertProblemStatementProvenanceMutation();

  // ── local state ───────────────────────────────────────────────────────────
  const [filter, setFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProblemStatement | null>(null);

  // ── derived ───────────────────────────────────────────────────────────────
  const statements = data?.problem_statement ?? [];

  const filtered = statements
    .filter((ps) => !filter || (ps.name ?? '').toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const ta = getLatestEvent(a.events)?.timestamp ?? '';
      const tb = getLatestEvent(b.events)?.timestamp ?? '';
      return ta < tb ? 1 : -1;
    });

  // ── form helpers ──────────────────────────────────────────────────────────
  function openAddDialog() {
    setForm({ ...EMPTY_FORM, regionId: selectedRegionId ?? '' });
    setDialogOpen(true);
  }

  function openEditDialog(ps: ProblemStatement) {
    const lastNotes = getLatestEventOfType(['CREATE', 'UPDATE'], ps.events)?.notes ?? '';
    setForm({
      id: ps.id,
      name: ps.name ?? '',
      regionId: ps.region_id,
      startDate: formatDate(ps.start_date),
      endDate: formatDate(ps.end_date),
      notes: lastNotes,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setForm(EMPTY_FORM);
  }

  // ── submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast({ title: 'Both dates are required', variant: 'destructive' });
      return;
    }
    if (form.startDate >= form.endDate) {
      toast({
        title: 'Start date must be before end date',
        variant: 'destructive',
      });
      return;
    }
    if (!form.regionId) {
      toast({ title: 'A region is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!form.id;
      if (isEdit) {
        await updatePS({
          variables: {
            id: form.id,
            name: form.name.trim(),
            regionId: form.regionId,
            startDate: form.startDate,
            endDate: form.endDate,
          },
        });
        if (user?.username) {
          await insertProvenance({
            variables: {
              problemStatementId: form.id,
              event: 'UPDATE',
              userid: user.username,
              notes: form.notes || null,
            },
          });
        }
        toast({ title: 'Problem statement updated' });
      } else {
        const newId = generateModelingId('problem_statement');
        await insertPS({
          variables: {
            id: newId,
            name: form.name.trim(),
            regionId: form.regionId,
            startDate: form.startDate,
            endDate: form.endDate,
          },
        });
        if (user?.username) {
          await insertProvenance({
            variables: {
              problemStatementId: newId,
              event: 'CREATE',
              userid: user.username,
              notes: form.notes || null,
            },
          });
        }
        toast({ title: 'Problem statement created' });
        navigate(`/modeling/problem-statement/${newId}`);
      }
      closeDialog();
      await refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deletePS({ variables: { id: deleteTarget.id } });
      toast({ title: 'Problem statement deleted' });
      await refetch();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Delete failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Problem Statements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an existing problem from the list below or click Add to create a new one.
        </p>
      </div>

      {/* ── Search bar + Add button ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="ps-search"
            placeholder="Search problem statements…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search problem statements"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          aria-label="Filter by region"
          value={selectedRegionId ?? ''}
          onChange={(e) => setSelectedRegionId(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={regions.length === 0}
        >
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button onClick={openAddDialog} aria-label="Add problem statement">
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          Failed to load problem statements: {error.message}
        </p>
      )}

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-40" />
          <p className="text-sm">
            {filter
              ? 'No problem statements match your search.'
              : 'No problem statements yet. Click Add to create one.'}
          </p>
        </div>
      )}

      {/* ── Grid of cards ─────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          role="list"
          aria-label="Problem statements"
        >
          {filtered.map((ps) => (
            <ProblemStatementCard
              key={ps.id}
              ps={ps}
              currentUserId={user?.username ?? null}
              onSelect={() => navigate(`/modeling/problem-statement/${ps.id}`)}
              onEdit={() => openEditDialog(ps)}
              onDelete={() => setDeleteTarget(ps)}
            />
          ))}
        </div>
      )}

      {/* ── Add / Edit dialog ─────────────────────────────────────────────── */}
      <ProblemStatementDialog
        open={dialogOpen}
        isEdit={!!form.id}
        form={form}
        regions={regions}
        saving={saving}
        onChange={(field, val) => setForm((f) => ({ ...f, [field]: val }))}
        onSubmit={handleSubmit}
        onCancel={closeDialog}
      />

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete problem statement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot; and all associated tasks
              and sub-tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

// ─── Card sub-component ───────────────────────────────────────────────────────

interface CardProps {
  ps: ProblemStatement;
  currentUserId: string | null;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProblemStatementCard({ ps, currentUserId, onSelect, onEdit, onDelete }: CardProps) {
  const perms = getUserPermission(ps.permissions, ps.events, currentUserId);
  const createEvent = getLatestEventOfType(['CREATE'], ps.events);
  const lastEvent = getLatestEvent(ps.events);

  return (
    <div
      role="listitem"
      className="group flex cursor-pointer gap-4 rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      tabIndex={0}
      aria-label={ps.name ?? 'Unnamed problem statement'}
    >
      {/* Icon */}
      <div className="flex items-center text-emerald-700">
        <ClipboardList className="h-12 w-12 opacity-80" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold leading-tight">{ps.name ?? 'Unnamed'}</h3>

          {/* Action buttons — stop propagation so click doesn't open detail */}
          <div className="flex shrink-0 gap-1">
            {perms.write && (
              <button
                type="button"
                aria-label={`Edit ${ps.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {perms.owner && (
              <button
                type="button"
                aria-label={`Delete ${ps.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <hr className="my-2" />

        {/* Metadata */}
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            <span className="font-medium">Time period:</span> {formatDate(ps.start_date)} to{' '}
            {formatDate(ps.end_date)}
          </p>
          {createEvent && (
            <p className="text-xs">
              Created by {createEvent.userid} at {formatDateTime(createEvent.timestamp)}
            </p>
          )}
          {lastEvent && (
            <p className="text-xs">
              Last updated by {lastEvent.userid} at {formatDateTime(lastEvent.timestamp)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dialog sub-component ─────────────────────────────────────────────────────

interface DialogProps {
  open: boolean;
  isEdit: boolean;
  form: FormValues;
  regions: TopRegion[];
  saving: boolean;
  onChange: (field: keyof FormValues, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function ProblemStatementDialog({
  open,
  isEdit,
  form,
  regions,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit problem statement' : 'What is your problem statement?'}
          </DialogTitle>
        </DialogHeader>

        {!isEdit && (
          <p className="text-sm text-muted-foreground">
            Please enter a short text to describe the overall problem. For example, &quot;Explore
            interventions to increase agricultural productivity in South Sudan&quot;.
          </p>
        )}

        <div className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="ps-name">Problem statement name</Label>
            <Input
              id="ps-name"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Explore interventions to increase crop yield"
              required
            />
          </div>

          {/* Region */}
          <div className="grid gap-1.5">
            <Label htmlFor="ps-region">Region</Label>
            <select
              id="ps-region"
              aria-label="Region"
              value={form.regionId}
              onChange={(e) => onChange('regionId', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="" disabled>
                Select a region…
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time period */}
          <div className="grid gap-1.5">
            <Label>Time period</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                id="ps-start"
                value={form.startDate}
                onChange={(e) => onChange('startDate', e.target.value)}
                aria-label="Start date"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                id="ps-end"
                value={form.endDate}
                onChange={(e) => onChange('endDate', e.target.value)}
                aria-label="End date"
                className="flex-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="ps-notes">Notes</Label>
            <textarea
              id="ps-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Optional notes…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
