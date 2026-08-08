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
import { ensembleManagerHeaders, fetchExecutionLog, submitRuns } from '@/lib/ensemble-manager';

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

  describe('submitRuns', () => {
    it('sends the access token as a Bearer header', async () => {
      storeTokens({ accessToken: 'stored-jwt' });
      await submitRuns('http://ensemble', 'localex', {
        thread_id: 'thread-1',
        model_id: 'model-1',
      });

      const [url, init] = lastRequest();
      expect(url).toBe('http://ensemble/executionEngines/localex');
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
      await submitRuns('http://ensemble', 'localex', {
        thread_id: 'thread-1',
        model_id: 'model-1',
      });
      expect(lastRequest()[1].headers).not.toHaveProperty('Authorization');
    });

    it('throws on a non-ok response', async () => {
      (globalThis.fetch as unknown as Mock).mockResolvedValue({ ok: false, status: 401 });
      await expect(
        submitRuns('http://ensemble', 'localex', { thread_id: 't', model_id: 'm' }),
      ).rejects.toThrow('Ensemble manager returned 401');
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
