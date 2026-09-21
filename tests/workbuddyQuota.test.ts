import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { WorkBuddyQuotaBody } from '@/features/quota/providers/workbuddy/WorkBuddyQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import { parseWorkBuddyQuota } from '@/services/api/workbuddyQuota';
import { classifyQuotaFiles, buildTabCounts } from '@/features/quota/logic';
import {
  useQuotaStore,
  captureQuotaCacheGeneration,
  commitIfQuotaCacheCurrent,
} from '@/stores/useQuotaStore';

test('WorkBuddy preserves packages, explicit zero, timezone and isolated cache', () => {
  const account = {
    auth_index: 'test',
    region: 'cn',
    plan: 'free',
    credits: {
      total_remain: 4,
      total_used: 6,
      total_size: 10,
      packages: [
        { name: 'Pack', remain: 4, used: 1, size: 5, cycle_end: '2099-09-30 23:59:59' },
        { name: 'Pack', remain: 0, used: 5, size: 5, cycle_end: '2000-09-30 23:59:59' },
      ],
    },
  };
  const data = parseWorkBuddyQuota(
    { accounts: [{ auth_index: 'other', error: 'wrong' }, account] },
    'test'
  );
  expect(data.summary.remaining).toBe(4);
  expect(data.pools).toHaveLength(2);
  expect(data.pools[1].remaining).toBe(0);
  expect(data.pools[0].expiresAt).toBe('2099-09-30T23:59:59+08:00');
  const classes = bindQuotaClasses(
    Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
    'test'
  );
  const markup = renderToStaticMarkup(
    createElement(WorkBuddyQuotaBody, { quota: { status: 'success', data }, classes })
  );
  expect(markup).toContain('<details');
  expect(markup).toContain(i18n.t('workbuddy_quota.packages', { count: 2 }));
  expect(markup.match(/>Pack</g)).toHaveLength(2);
  expect(markup).toContain('2099-09-30T23:59:59+08:00');
  expect(markup).toContain(i18n.t('qoder_quota.expired'));
  expect(markup.match(/class="quotaBar"/g)).toHaveLength(3);
  expect(() => parseWorkBuddyQuota({ accounts: [] }, 'test')).toThrow();
  expect(() =>
    parseWorkBuddyQuota(
      { accounts: [{ ...account, credits: { ...account.credits, total_remain: undefined } }] },
      'test'
    )
  ).toThrow();
  const file = { name: 'workbuddy-test.json', provider: 'workbuddy', authIndex: 'test' };
  expect(buildTabCounts(classifyQuotaFiles([file])).workbuddy).toBe(1);
  useQuotaStore.getState().setWorkBuddyQuota({ [file.name]: { status: 'success', data } });
  const generation = captureQuotaCacheGeneration(file.name);
  useQuotaStore.getState().clearQuotaCache([file.name]);
  expect(useQuotaStore.getState().workbuddyQuota).toEqual({});
  expect(commitIfQuotaCacheCurrent(generation, () => {})).toBe(false);
});
