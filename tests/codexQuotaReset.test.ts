import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { CODEX_CONFIG } from '@/features/quota/providers/codex/data';
import { apiClient } from '@/services/api/client';
import { CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL, CODEX_USAGE_URL } from '@/utils/quota';
import { useQuotaStore } from '@/stores/useQuotaStore';

const t = ((key: string) => key) as TFunction;
const file = { name: 'codex-test.json', type: 'codex', auth_index: 'auth-test' };
afterEach(() => mock.restore());

describe('Codex quota reset recovery', () => {
  test('refreshes credential status when a quota query recovers routing', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const target = new EventTarget();
    Object.defineProperty(globalThis, 'window', { value: target, configurable: true });
    let changes = 0;
    target.addEventListener('auth-files-changed', () => changes++);
    spyOn(apiClient, 'post').mockImplementation(async (_path, data) => ({
      status_code: 200,
      quota_recovered: (data as { url?: string }).url === CODEX_USAGE_URL,
      body: JSON.stringify({ rate_limit: { allowed: true, primary_window: { used_percent: 0 } } }),
    }));
    try {
      await CODEX_CONFIG.fetchQuota(file, t);
      expect(changes).toBe(1);
    } finally {
      if (original) Object.defineProperty(globalThis, 'window', original);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  test('clears CPA cooldown after consuming the credit, before refreshing quota', async () => {
    const calls: string[] = [];
    spyOn(apiClient, 'post').mockImplementation(async (path, data) => {
      const request = data as { url?: string };
      calls.push(request.url ?? path);
      if (path === '/reset-quota') {
        expect(data).toEqual({ auth_index: 'auth-test' });
        return { status: 'ok' };
      }
      return { status_code: 200, body: JSON.stringify(request.url === CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL
        ? { code: 'reset', windows_reset: 1 }
        : request.url === CODEX_USAGE_URL
          ? { plan_type: 'pro', rate_limit: { allowed: true, primary_window: { used_percent: 0, limit_window_seconds: 604800 } } }
          : { available_count: 0, credits: [] }) };
    });
    await CODEX_CONFIG.resetQuota!(file, t);
    expect(calls.slice(0, 3)).toEqual([CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL, '/reset-quota', CODEX_USAGE_URL]);
  });

  test('does not clear cooldown when the official reset is rejected', async () => {
    const post = spyOn(apiClient, 'post').mockResolvedValue({ status_code: 429, body: '{"error":"exhausted"}' });
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('does not clear cooldown for an unrecognized successful response', async () => {
    const post = spyOn(apiClient, 'post').mockResolvedValue({ status_code: 200, body: '{"code":"unknown"}' });
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toThrow('codex_quota.reset_invalid_response');
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('reports post-reset failure separately and never consumes another credit', async () => {
    const calls: string[] = [];
    spyOn(apiClient, 'post').mockImplementation(async (path, data) => {
      calls.push((data as { url?: string }).url ?? path);
      if (path === '/reset-quota') throw new Error('recovery unavailable');
      return { status_code: 200, body: '{"code":"reset","windows_reset":1}' };
    });
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toMatchObject({ name: 'CodexQuotaResetAppliedError' });
    expect(calls).toEqual([CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL, '/reset-quota']);
  });

  test('does not clear cooldown on a different connection after a reset completes', async () => {
    const post = spyOn(apiClient, 'post').mockImplementation(async () => {
      useQuotaStore.getState().clearQuotaCache();
      return { status_code: 200, body: '{"code":"reset","windows_reset":1}' };
    });
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });
});
