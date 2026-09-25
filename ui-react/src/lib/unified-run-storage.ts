import type { UnifiedRunSnapshot } from './ensemble-manager';

/** Bump when the browser cache shape changes. Stored data is disposable. */
const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'mint.unified-workflow';
const MAX_CACHED_RUNS = 10;
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface CachedRun {
  snapshot: UnifiedRunSnapshot;
  savedAt: number;
}

interface StorageEnvelope {
  version: number;
  activeRunId: string | null;
  runs: Record<string, CachedRun>;
}

function storageKey(userKey: string, threadId: string, modelId: string): string {
  return `${STORAGE_PREFIX}.v${STORAGE_VERSION}.${encodeURIComponent(userKey)}.${encodeURIComponent(threadId)}.${encodeURIComponent(modelId)}`;
}

function emptyEnvelope(): StorageEnvelope {
  return { version: STORAGE_VERSION, activeRunId: null, runs: {} };
}

function isSnapshot(value: unknown): value is UnifiedRunSnapshot {
  return Boolean(value && typeof value === 'object');
}

function readEnvelope(key: string): StorageEnvelope {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw) as Partial<StorageEnvelope>;
    if (parsed.version !== STORAGE_VERSION || !parsed.runs || typeof parsed.runs !== 'object') {
      localStorage.removeItem(key);
      return emptyEnvelope();
    }

    const now = Date.now();
    const runs = Object.fromEntries(
      Object.entries(parsed.runs).filter(([, cached]) => {
        return (
          cached &&
          typeof cached.savedAt === 'number' &&
          now - cached.savedAt <= MAX_CACHE_AGE_MS &&
          isSnapshot(cached.snapshot) &&
          typeof cached.snapshot.run_id === 'string'
        );
      }),
    );
    const activeRunId =
      typeof parsed.activeRunId === 'string' && runs[parsed.activeRunId]
        ? parsed.activeRunId
        : (Object.values(runs)
            .sort((a, b) => b.savedAt - a.savedAt)
            .map((entry) => entry.snapshot.run_id)
            .find((id): id is string => typeof id === 'string') ?? null);
    return { version: STORAGE_VERSION, activeRunId, runs };
  } catch {
    // Storage can be disabled or contain data from an older build. The cache
    // must never prevent the modeling page from rendering.
    return emptyEnvelope();
  }
}

/**
 * Read the latest workflow snapshot for a thread/model pair.
 *
 * Only the small orchestration snapshot is cached. Application logs and
 * tokens remain server-side and are fetched through their existing APIs.
 */
export function loadUnifiedRunSnapshot(
  userKey: string,
  threadId: string,
  modelId: string,
): UnifiedRunSnapshot | null {
  const envelope = readEnvelope(storageKey(userKey, threadId, modelId));
  const cached = envelope.activeRunId ? envelope.runs[envelope.activeRunId] : undefined;
  return cached?.snapshot ?? null;
}

/** Save a workflow snapshot without allowing storage failures to affect runs. */
export function saveUnifiedRunSnapshot(
  userKey: string,
  threadId: string,
  modelId: string,
  snapshot: UnifiedRunSnapshot,
): void {
  if (typeof snapshot.run_id !== 'string' || !snapshot.run_id.startsWith('ue_')) return;

  const key = storageKey(userKey, threadId, modelId);
  const envelope = readEnvelope(key);
  const savedAt = Date.now();
  envelope.runs[snapshot.run_id] = { snapshot, savedAt };
  envelope.activeRunId = snapshot.run_id;

  const recentRuns = Object.entries(envelope.runs)
    .sort(([, a], [, b]) => b.savedAt - a.savedAt)
    .slice(0, MAX_CACHED_RUNS);
  envelope.runs = Object.fromEntries(recentRuns);

  try {
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota/private-mode failures are non-fatal. The live in-memory state still
    // shows the workflow, and the next visit can simply start without a cache.
  }
}

/** Remove cached workflow history when a new submission is not a pipeline run. */
export function clearUnifiedRunSnapshots(userKey: string, threadId: string, modelId: string): void {
  try {
    localStorage.removeItem(storageKey(userKey, threadId, modelId));
  } catch {
    // Storage is optional and must never block a new model submission.
  }
}
