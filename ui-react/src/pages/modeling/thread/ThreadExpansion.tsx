/**
 * ThreadExpansion — reusable collapsible panel for the thread workflow.
 *
 * 1:1 port of the legacy LitElement ThreadExpansion component.
 * Provides expand/collapse, view/edit modes, loading overlay, and a
 * Save/Cancel footer when in edit mode.
 *
 * Subclasses override renderView() and renderEditForm() — here expressed
 * as render props (viewContent / editContent) for React.
 */
import { ChevronDown, ChevronRight, Edit, Save, X } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

export type ExpansionStatus = 'warning' | 'done' | 'error';

interface ThreadExpansionProps {
  /** Panel title */
  name: string;
  /** Brief description shown in the header */
  description: React.ReactNode;
  /** Current status drives the icon colour */
  status: ExpansionStatus;
  /** Short info string shown in the header bar when collapsed */
  statusInfo: string;
  /** Whether the panel starts open */
  defaultOpen?: boolean;
  /** Whether to show the edit button (write permission) */
  canEdit?: boolean;
  /** Whether a save operation is in progress */
  loading?: boolean;
  /** Content rendered in view mode */
  viewContent: React.ReactNode;
  /** Content rendered in edit mode (null = no edit possible) */
  editContent?: React.ReactNode;
  /** Called when Save is clicked — return a promise to auto-reset loading */
  onSave?: () => Promise<void> | void;
  /** Called when Cancel is clicked */
  onCancel?: () => void;
  /** Called when the panel is opened */
  onOpen?: () => void;
  /** Called when the panel is closed */
  onClose?: () => void;
  className?: string;
}

const STATUS_CLASS: Record<ExpansionStatus, string> = {
  done: 'text-green-600',
  warning: 'text-orange-500',
  error: 'text-red-500',
};

const STATUS_ICON: Record<ExpansionStatus, string> = {
  done: '✓',
  warning: '⚠',
  error: '✕',
};

export function ThreadExpansion({
  name,
  description,
  status,
  statusInfo,
  defaultOpen = false,
  canEdit = false,
  loading = false,
  viewContent,
  editContent,
  onSave,
  onCancel,
  onOpen,
  onClose,
  className,
}: ThreadExpansionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
    else onClose?.();
  }

  function handleEditEnable() {
    setEditMode(true);
  }

  function handleCancel() {
    setEditMode(false);
    onCancel?.();
  }

  async function handleSave() {
    if (!onSave) {
      setEditMode(false);
      return;
    }
    setSaving(true);
    try {
      await onSave();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  const isBusy = loading || saving;

  return (
    <div
      className={cn('mb-1 border-b border-gray-200', editMode && 'bg-yellow-50', className)}
      data-testid="thread-expansion"
    >
      {/* Header row */}
      <div
        className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 hover:bg-gray-50"
        onClick={handleToggle}
        aria-expanded={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleToggle()}
      >
        {/* Chevron */}
        <span className="shrink-0 text-gray-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        {/* Status icon */}
        <span className={cn('shrink-0 font-bold', STATUS_CLASS[status])} aria-hidden>
          {STATUS_ICON[status]}
        </span>

        {/* Title */}
        <span className="flex-1 text-sm font-semibold">{name}</span>

        {/* Status info (shown when collapsed) */}
        {!open && <span className="max-w-xs truncate text-xs text-gray-500">{statusInfo}</span>}
      </div>

      {/* Expanded body */}
      {open && (
        <div className="relative px-4 pb-4">
          {/* Loading overlay */}
          {isBusy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-gray-500/30">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          )}

          {/* Separator */}
          <hr className="-mx-4 mb-3" />

          {/* Description + edit button row */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-sm text-gray-600">{description}</p>
            {canEdit && !editMode && editContent !== undefined && (
              <button
                type="button"
                aria-label={`Edit ${name}`}
                onClick={handleEditEnable}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Content */}
          {editMode && editContent !== undefined ? editContent : viewContent}

          {/* Footer buttons (edit mode only) */}
          {editMode && (
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isBusy}
                className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isBusy}
                className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
