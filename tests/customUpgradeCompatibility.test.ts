import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { CODEX_CONFIG } from '@/features/quota/providers/codex/data';
import { resolveAuthFileQuotaType } from '@/features/authFiles/logic';
import { resolveQuotaProviderType } from '@/features/quota/logic';
import { apiClient, apiCallApi, authFilesApi } from '@/services/api';
import { keyPoliciesApi } from '@/services/api/keyPolicies';
import { fetchQoderQuota } from '@/services/api/qoderQuota';
import { fetchWorkBuddyQuota } from '@/services/api/workbuddyQuota';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { CODEX_USAGE_URL, CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL } from '@/utils/quota';

const t = ((key: string) => key) as TFunction;
const file = { name: 'codex-test.json', type: 'codex', auth_index: 'test-index' };
afterEach(() => mock.restore());

describe('custom behavior after the v8 frontend upgrade', () => {
  test.each(['qoder', 'workbuddy', 'cursor'])('keeps %s billing cards on both pages', (type) => {
    for (const supportsQuota of [true, false]) {
      const credential = { name: type + '.json', type, supportsQuota, quotaProvider: type };
      expect(resolveQuotaProviderType(credential)).toBe(type);
      expect(resolveAuthFileQuotaType(credential, 'all')).toBe(type);
      expect(resolveAuthFileQuotaType(credential, type)).toBe(type);
    }
  });

  test('preserves the deployment prefix for custom extension reads and writes', async () => {
    apiClient.setConfig({
      apiBase: 'https://proxy.example/cpa/v8/management',
      managementKey: 'fixture-only',
    });
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      revision: 1,
      accounts: [
        {
          auth_index: 'test-index',
          credits: { packages: [], total_remain: 0, total_used: 0, total_size: 0 },
        },
      ],
    });
    const put = spyOn(apiClient, 'put').mockResolvedValue({});
    await keyPoliciesApi.get();
    expect(get.mock.calls.at(-1)?.[0]).toBe('https://proxy.example/cpa/v0/management/key-policies');
    await keyPoliciesApi.save(1, {
      keyId: 'key/id',
      keyPreview: '',
      label: '',
      allowAll: true,
      rules: [],
    });
    expect(put.mock.calls.at(-1)?.[0]).toBe(
      'https://proxy.example/cpa/v0/management/key-policies/key%2Fid'
    );
    await fetchQoderQuota('test-index');
    expect(get.mock.calls.at(-1)?.[0]).toBe(
      'https://proxy.example/cpa/v0/management/plugins/qoder/credits'
    );
    await fetchWorkBuddyQuota('test-index');
    expect(get.mock.calls.at(-1)?.[0]).toBe(
      'https://proxy.example/cpa/v0/management/plugins/workbuddy/credits'
    );
    apiClient.setConfig({ apiBase: '', managementKey: '' });
  });

  test('refreshes credentials when an official quota query recovers routing', async () => {
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

  test('rejects malformed reset confirmation before clearing any cooldown', async () => {
    spyOn(apiCallApi, 'request').mockResolvedValue({
      statusCode: 200,
      body: { code: 'reset' },
      bodyText: '',
      header: {},
    });
    const clear = spyOn(authFilesApi, 'resetCooldown');
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toThrow(
      'codex_quota.reset_invalid_response'
    );
    expect(clear).not.toHaveBeenCalled();
  });

  test('does not clear a new quota cache generation after redemption', async () => {
    spyOn(apiCallApi, 'request').mockImplementation(async () => {
      useQuotaStore.getState().clearQuotaCache();
      return {
        statusCode: 200,
        body: { code: 'reset', windows_reset: 1 },
        bodyText: '',
        header: {},
      };
    });
    const clear = spyOn(authFilesApi, 'resetCooldown');
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toMatchObject({
      name: 'CodexQuotaResetAppliedError',
    });
    expect(clear).not.toHaveBeenCalled();
  });

  test('does not redeem twice when refresh fails after a confirmed cooldown reset', async () => {
    const request = spyOn(apiCallApi, 'request').mockImplementation(async (payload) => {
      if (payload.url !== CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL)
        throw new Error('refresh unavailable');
      return {
        statusCode: 200,
        body: { code: 'reset', windows_reset: 1 },
        bodyText: '',
        header: {},
      };
    });
    spyOn(authFilesApi, 'resetCooldown').mockResolvedValue({
      status: 'ok',
      auth_index: 'test-index',
      models: [],
    });
    await expect(CODEX_CONFIG.resetQuota!(file, t)).rejects.toMatchObject({
      name: 'CodexQuotaResetAppliedError',
    });
    expect(
      request.mock.calls.filter(
        ([payload]) => payload.url === CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL
      )
    ).toHaveLength(1);
  });
});
