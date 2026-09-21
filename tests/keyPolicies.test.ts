import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  validPolicyAmount,
  serializePolicy,
  normalizePolicyReport,
} from '../src/services/api/keyPolicies';
import { Card } from '../src/components/ui/Card';

describe('key policy contract', () => {
  test('exact decimal amounts include zero and reject unsafe formats', () => {
    for (const value of ['0', '0.000001', '12.340000', '9223372036854.775807'])
      expect(validPolicyAmount(value)).toBe(true);
    for (const value of ['', '-1', '1e2', '.5', '1.', '1.0000001', '9223372036854.775808'])
      expect(validPolicyAmount(value)).toBe(false);
  });
  test('serializes only safe fields and preserves removed resource rules', () => {
    const policy = {
      keyId: 'fingerprint',
      keyPreview: '…1234',
      label: 'Team',
      allowAll: false,
      rules: [{ resourceId: 'deleted-resource', period: 'month' as const, limitUsd: '0' }],
    };
    expect(serializePolicy(7, policy)).toEqual({
      revision: 7,
      label: 'Team',
      allow_all: false,
      rules: [{ resource_id: 'deleted-resource', period: 'month', limit_usd: '0' }],
    });
    expect(() =>
      serializePolicy(7, { ...policy, rules: [...policy.rules, ...policy.rules] })
    ).toThrow();
    expect(
      serializePolicy(7, {
        ...policy,
        allowAll: true,
        rules: [{ ...policy.rules[0], limitUsd: null }],
      }).rules[0].limit_usd
    ).toBeNull();
  });
  test('normalizes empty Go slices and masked rendering', () => {
    expect(
      normalizePolicyReport({
        revision: 1,
        keys: null,
        resources: null,
        budgets: null,
        prices_updated_at: '',
      }).keys
    ).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(Card, { title: 'Key permissions' }, createElement('code', null, '…1234'))
    );
    expect(html).toContain('…1234');
    expect(html).toContain('card-header');
  });
});
