import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { parseQoderQuota } from '@/services/api/qoderQuota';
import { QoderQuotaBody } from '@/features/quota/providers/qoder/QoderQuotaBody';
import { classifyQuotaFiles, buildTabCounts } from '@/features/quota/logic';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import {
  captureQuotaCacheGeneration,
  commitIfQuotaCacheCurrent,
  useQuotaStore,
} from '@/stores/useQuotaStore';

test('Qoder balances retain exhausted, dedicated and unknown shared capacity independently', () => {
  const file = { name: 'qoder-test.json', provider: 'qoder', authIndex: 'test' };
  expect(buildTabCounts(classifyQuotaFiles([file])).qoder).toBe(1);
  expect(classifyQuotaFiles([{ ...file, disabled: true }])).toHaveLength(0);
  const data = parseQoderQuota(
    {
      accounts: [
        {
          auth_index: 'test',
          plan: 'Teams',
          credits: {
            packages: [
              {
                kind: 'plan',
                name: 'Teams',
                remain: 0,
                used: 1000,
                size: 1000,
                size_known: true,
                available: true,
              },
              {
                kind: 'dedicated',
                name: 'SOTA',
                remain: 123.45,
                used: 376.55,
                size: 500,
                size_known: true,
                available: false,
                cycle_end: '2020-01-01T00:00:00Z',
              },
              {
                kind: 'shared',
                name: 'Shared',
                remain: 75,
                used: 0,
                size: -1,
                size_known: false,
                available: true,
              },
            ],
          },
        },
      ],
    },
    'test'
  );
  expect(data.pools[2].total).toBeNull();
  const quota = { status: 'success' as const, data };
  const classes = bindQuotaClasses(
    Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
    'test'
  );
  const markup = renderToStaticMarkup(createElement(QoderQuotaBody, { quota, classes }));
  expect(markup).toContain('Teams');
  expect(markup).toContain('SOTA');
  expect(markup).toContain('123.45');
  expect(markup).toContain('width:0%');
  expect(markup.match(/class="quotaBar"/g)).toHaveLength(2);
  expect(markup).toContain(i18n.t('qoder_quota.expired'));
  expect(markup).not.toContain(i18n.t('qoder_quota.loading'));
  expect(() => parseQoderQuota({ accounts: [] }, 'test')).toThrow();
  useQuotaStore.getState().setQoderQuota({ [file.name]: quota });
  const generation = captureQuotaCacheGeneration(file.name);
  useQuotaStore.getState().clearQuotaCache();
  expect(useQuotaStore.getState().qoderQuota).toEqual({});
  expect(commitIfQuotaCacheCurrent(generation, () => {})).toBe(false);
});
