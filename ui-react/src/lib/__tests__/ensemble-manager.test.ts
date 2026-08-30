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
  ensembleManagerHeaders,
  executionEnginePath,
  fetchExecutionLog,
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
