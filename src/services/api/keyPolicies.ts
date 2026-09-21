import { apiClient } from './client';

export const policyPeriods = ['day', 'week', 'month', 'codex_primary', 'codex_weekly'] as const;
export type PolicyPeriod = (typeof policyPeriods)[number];
export interface PolicyRule {
  resourceId: string;
  period: PolicyPeriod;
  limitUsd: string | null;
}
export interface KeyPolicy {
  keyId: string;
  keyPreview: string;
  label: string;
  allowAll: boolean;
  rules: PolicyRule[];
}
export interface PolicyResource {
  resourceId: string;
  label: string;
  provider: string;
  kind: string;
  disabled: boolean;
  models: string[];
}
export interface PolicyBudget {
  keyId: string;
  resourceId: string;
  period: string;
  limitUsd: string | null;
  usedUsd: string;
  reservedUsd: string;
  remainingUsd: string | null;
  resetAt: string;
  status: string;
  unpricedRequests: number;
}
export interface PolicyReport {
  revision: number;
  keys: KeyPolicy[];
  resources: PolicyResource[];
  budgets: PolicyBudget[];
  pricesUpdatedAt: string;
}
type WireRule = { resource_id: string; period: PolicyPeriod; limit_usd: string | null };
interface WireReport {
  revision: number;
  keys:
    | {
        key_id: string;
        key_preview: string;
        label: string;
        allow_all: boolean;
        rules: WireRule[] | null;
      }[]
    | null;
  resources:
    | {
        resource_id: string;
        label: string;
        provider: string;
        kind: string;
        disabled: boolean;
        models: string[] | null;
      }[]
    | null;
  budgets:
    | {
        key_id: string;
        resource_id: string;
        period: string;
        limit_usd: string | null;
        used_usd: string;
        reserved_usd: string;
        remaining_usd: string | null;
        reset_at: string;
        status: string;
        unpriced_requests: number;
      }[]
    | null;
  prices_updated_at: string;
}
export function validPolicyAmount(value: string): boolean {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(6, '0')) <= 9223372036854775807n;
}
export function serializePolicy(revision: number, policy: KeyPolicy) {
  const seen = new Set<string>();
  for (const rule of policy.rules) {
    if (
      !rule.resourceId ||
      seen.has(rule.resourceId) ||
      !policyPeriods.includes(rule.period) ||
      (rule.limitUsd !== null && !validPolicyAmount(rule.limitUsd))
    )
      throw new Error('Invalid policy');
    seen.add(rule.resourceId);
  }
  return {
    revision,
    label: policy.label,
    allow_all: policy.allowAll,
    rules: policy.rules.map((rule) => ({
      resource_id: rule.resourceId,
      period: rule.period,
      limit_usd: rule.limitUsd,
    })),
  };
}
export function normalizePolicyReport(data: WireReport): PolicyReport {
  return {
    revision: data.revision,
    keys: (data.keys ?? []).map((key) => ({
      keyId: key.key_id,
      keyPreview: key.key_preview,
      label: key.label,
      allowAll: key.allow_all,
      rules: (key.rules ?? []).map((rule) => ({
        resourceId: rule.resource_id,
        period: rule.period,
        limitUsd: rule.limit_usd,
      })),
    })),
    resources: (data.resources ?? []).map((r) => ({
      resourceId: r.resource_id,
      label: r.label,
      provider: r.provider,
      kind: r.kind,
      disabled: r.disabled,
      models: r.models ?? [],
    })),
    budgets: (data.budgets ?? []).map((b) => ({
      keyId: b.key_id,
      resourceId: b.resource_id,
      period: b.period,
      limitUsd: b.limit_usd,
      usedUsd: b.used_usd,
      reservedUsd: b.reserved_usd,
      remainingUsd: b.remaining_usd,
      resetAt: b.reset_at,
      status: b.status,
      unpricedRequests: b.unpriced_requests,
    })),
    pricesUpdatedAt: data.prices_updated_at,
  };
}
export const keyPoliciesApi = {
  get: async () => normalizePolicyReport(await apiClient.get<WireReport>('/key-policies')),
  save: (revision: number, policy: KeyPolicy) =>
    apiClient.put(
      '/key-policies/' + encodeURIComponent(policy.keyId),
      serializePolicy(revision, policy)
    ),
};
