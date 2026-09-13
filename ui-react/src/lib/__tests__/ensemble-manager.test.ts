/**
 * Tests for the Ensemble Manager REST calls.
 *
 * Regression guard for #85: these assert the outgoing Authorization header, not
 * the localStorage key. The bug was a key read by string literal that nothing
 * wrote, and a conditional spread that dropped the header without erroring — so
 * a test on the storage key would have passed while every call went out
 * anonymous.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { storeTokens } from '@/lib/auth/token-store';
import {
  EnsembleManagerError,
  NO_OUTPUTS_DECLARED,
  ensembleManagerHeaders,
  executionEnginePath,
  fetchExecutionFiles,
  fetchExecutionLog,
  publishExecution,
  publishResults,
  submitRuns,
} from '@/lib/ensemble-manager';

function lastRequest(): [string, RequestInit] {
  const calls = (globalThis.fetch as unknown as Mock).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

describe('ensemble-manager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('log line') }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe('ensembleManagerHeaders', () => {
    it('reads the same key token-store writes', () => {
      storeTokens({ accessToken: 'stored-jwt' });
      expect(ensembleManagerHeaders()).toEqual({ Authorization: 'Bearer stored-jwt' });
    });

    it('omits Authorization when no token is stored', () => {
      expect(ensembleManagerHeaders()).toEqual({});
    });

    it('keeps the base headers alongside the credential', () => {
      storeTokens({ accessToken: 'stored-jwt' });
      expect(ensembleManagerHeaders({ 'Content-Type': 'application/json' })).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer stored-jwt',
      });
    });
  });

  describe('executionEnginePath', () => {
    // Regression guard for #88: the app posted every engine to
    // /executionEngines/<engine>, but the Ensemble Manager registers that
    // prefix for Tapis only and keeps the two older backends on their own
    // paths. Submission 404'd before authentication mattered.
    it('routes localex to its own path, not the executionEngines prefix', () => {
      expect(executionEnginePath('localex')).toBe('/executionsLocal');
    });

    it('routes wings to its own path', () => {
      expect(executionEnginePath('wings')).toBe('/executions');
    });

    it('routes tapis under the executionEngines prefix', () => {
      expect(executionEnginePath('tapis')).toBe('/executionEngines/tapis');
    });

    it('routes an unknown engine under the executionEngines prefix', () => {
      expect(executionEnginePath('slurm')).toBe('/executionEngines/slurm');
    });
  });

  describe('submitRuns', () => {
    it('posts to the route the named engine is served on', async () => {
      await submitRuns('http://ensemble', 'localex', { thread_id: 't', model_id: 'm' });
      expect(lastRequest()[0]).toBe('http://ensemble/executionsLocal');
    });

    it('sends the access token as a Bearer header', async () => {
      storeTokens({ accessToken: 'stored-jwt' });
      await submitRuns('http://ensemble', 'tapis', {
        thread_id: 'thread-1',
        model_id: 'model-1',
      });

      const [url, init] = lastRequest();
      expect(url).toBe('http://ensemble/executionEngines/tapis');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer stored-jwt',
      });
      expect(JSON.parse(init.body as string)).toEqual({
        thread_id: 'thread-1',
        model_id: 'model-1',
      });
    });

    it('sends no Authorization header when logged out', async () => {
      await submitRuns('http://ensemble', 'tapis', {
        thread_id: 'thread-1',
        model_id: 'model-1',
      });
      expect(lastRequest()[1].headers).not.toHaveProperty('Authorization');
    });

    it('throws on a non-ok response', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({ ok: false, status: 401 });
      await expect(
        submitRuns('http://ensemble', 'tapis', { thread_id: 't', model_id: 'm' }),
      ).rejects.toThrow('Ensemble manager returned 401');
    });
  });

  describe('publishResults', () => {
    const ids = { problemStatementId: 'ps-1', taskId: 'task-1', threadId: 'thread-1' };

    it('posts to the subtask outputs route the legacy UI calls', async () => {
      await publishResults('http://ensemble', ids);
      expect(lastRequest()[0]).toBe(
        'http://ensemble/problemStatements/ps-1/tasks/task-1/subtasks/thread-1/outputs',
      );
      expect(lastRequest()[1].method).toBe('POST');
    });

    it('sends the access token as a Bearer header', async () => {
      storeTokens({ accessToken: 'stored-jwt' });
      await publishResults('http://ensemble', ids);
      expect(lastRequest()[1].headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer stored-jwt',
      });
    });

    it("surfaces the server's own message, so a dead credential is not a bare 400", async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'No executions found to publish' }),
      });
      await expect(publishResults('http://ensemble', ids)).rejects.toThrow(
        'Ensemble manager returned 400: No executions found to publish',
      );
    });

    it('still reports the status when the body carries no message', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      });
      await expect(publishResults('http://ensemble', ids)).rejects.toThrow(
        'Ensemble manager returned 500',
      );
    });

    // The status alone does not say what to do. 422 NO_OUTPUTS_DECLARED names a
    // missing declaration the user repairs by promoting a file, and the Results
    // step branches on the code to offer that instead of the raw text (#267).
    it("carries the server's own error code", async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            code: 'NO_OUTPUTS_DECLARED',
            message: 'The model configuration declares no output',
          }),
      });
      await expect(publishResults('http://ensemble', ids)).rejects.toMatchObject({
        status: 422,
        code: NO_OUTPUTS_DECLARED,
      });
    });

    it('throws an EnsembleManagerError, so a caller can read the code off it', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'nope' }),
      });
      await expect(publishResults('http://ensemble', ids)).rejects.toBeInstanceOf(
        EnsembleManagerError,
      );
    });

    it('leaves the code undefined when the server sends none', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'nope' }),
      });
      await expect(publishResults('http://ensemble', ids)).rejects.toMatchObject({
        code: undefined,
      });
    });
  });

  describe('publishExecution', () => {
    const ids = { problemStatementId: 'ps-1', taskId: 'task-1', threadId: 'thread-1' };

    it('posts to the outputs route of one execution', async () => {
      await publishExecution('http://ensemble', ids, 'exec-1');
      expect(lastRequest()[0]).toBe(
        'http://ensemble/problemStatements/ps-1/tasks/task-1/subtasks/thread-1' +
          '/executions/exec-1/outputs',
      );
      expect(lastRequest()[1].method).toBe('POST');
    });

    it('sends the access token as a Bearer header', async () => {
      storeTokens({ accessToken: 'stored-jwt' });
      await publishExecution('http://ensemble', ids, 'exec-1');
      expect(lastRequest()[1].headers).toMatchObject({ Authorization: 'Bearer stored-jwt' });
    });

    it('escapes an id that carries slashes, so it stays one path segment', async () => {
      await publishExecution('http://ensemble', ids, 'mint://exec/1');
      expect(lastRequest()[0]).toContain('/executions/mint%3A%2F%2Fexec%2F1/outputs');
    });

    it('carries the 422 code, so the dialog can ask for a promotion', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ code: 'NO_OUTPUTS_DECLARED', message: 'no outputs' }),
      });
      await expect(publishExecution('http://ensemble', ids, 'exec-1')).rejects.toMatchObject({
        code: NO_OUTPUTS_DECLARED,
      });
    });
  });

  describe('fetchExecutionFiles', () => {
    it('reads the files of one execution', async () => {
      const files = [{ name: 'out.tif', path: 'output/out.tif', size: 12, url: 'tapis://x' }];
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files }),
      });
      storeTokens({ accessToken: 'stored-jwt' });

      await expect(fetchExecutionFiles('http://ensemble', 'exec-1')).resolves.toEqual(files);
      const [url, init] = lastRequest();
      expect(url).toBe('http://ensemble/executions/exec-1/files');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer stored-jwt' });
    });

    // An archive that holds nothing is not an error: the run may still be on
    // its way, and the server answers 200 with an empty list.
    it('answers an empty list when the archive holds nothing', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      });
      await expect(fetchExecutionFiles('http://ensemble', 'exec-1')).resolves.toEqual([]);
    });

    it('answers an empty list when the body carries no files key', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
      await expect(fetchExecutionFiles('http://ensemble', 'exec-1')).resolves.toEqual([]);
    });

    it('forwards the abort signal', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      });
      const ctrl = new AbortController();
      await fetchExecutionFiles('http://ensemble', 'exec-1', ctrl.signal);
      expect(lastRequest()[1].signal).toBe(ctrl.signal);
    });

    it("surfaces the server's own message", async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'This instance runs localex' }),
      });
      await expect(fetchExecutionFiles('http://ensemble', 'exec-1')).rejects.toThrow(
        'Ensemble manager returned 400: This instance runs localex',
      );
    });
  });

  describe('fetchExecutionLog', () => {
    it('sends the access token as a Bearer header', async () => {
      storeTokens({ accessToken: 'stored-jwt' });
      const text = await fetchExecutionLog('http://ensemble', 'exec-1');

      const [url, init] = lastRequest();
      expect(url).toBe('http://ensemble/executions/exec-1/logs');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer stored-jwt' });
      expect(text).toBe('log line');
    });

    it('sends no Authorization header when logged out', async () => {
      await fetchExecutionLog('http://ensemble', 'exec-1');
      expect(lastRequest()[1].headers).not.toHaveProperty('Authorization');
    });

    it('forwards the abort signal', async () => {
      const ctrl = new AbortController();
      await fetchExecutionLog('http://ensemble', 'exec-1', ctrl.signal);
      expect(lastRequest()[1].signal).toBe(ctrl.signal);
    });

    it('throws on a non-ok response', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({ ok: false, status: 404 });
      await expect(fetchExecutionLog('http://ensemble', 'exec-1')).rejects.toThrow('HTTP 404');
    });
  });
});
