import { apiClient } from './client';
import type { QoderQuotaData, QoderQuotaState, QoderPool } from './qoderQuota';

export interface WorkBuddyQuotaData extends QoderQuotaData {
  summary: QoderPool;
}
export interface WorkBuddyQuotaState extends Omit<QoderQuotaState, 'data'> {
  data?: WorkBuddyQuotaData;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function parseWorkBuddyQuota(value: unknown, authIndex: string): WorkBuddyQuotaData {
  const accounts = record(value).accounts;
  const account = Array.isArray(accounts)
    ? accounts.map(record).find((row) => String(row.auth_index) === authIndex)
    : undefined;
  if (!account) throw new Error('workbuddy_quota.empty_data');
  if (account.error) throw new Error(String(account.error));
  const credits = record(account.credits);
  if (!Array.isArray(credits.packages)) throw new Error('workbuddy_quota.empty_data');
  const amount = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      throw new Error('workbuddy_quota.invalid_data');
    return value;
  };
  return {
    plan: typeof account.plan === 'string' ? account.plan : '',
    summary: {
      kind: 'total',
      name: '',
      remaining: amount(credits.total_remain),
      used: amount(credits.total_used),
      total: amount(credits.total_size),
      available: true,
      expiresAt: null,
    },
    pools: credits.packages.map((value) => {
      const pool = record(value);
      let expiry = typeof pool.cycle_end === 'string' ? pool.cycle_end.trim() : '';
      // CN billing dates have no offset; never interpret them in the browser's local zone.
      if (expiry && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(expiry)) {
        expiry = account.region === 'cn' ? `${expiry.replace(' ', 'T')}+08:00` : '';
      }
      const remaining = amount(pool.remain);
      return {
        kind: 'package',
        name: typeof pool.name === 'string' ? pool.name : '',
        remaining,
        used: amount(pool.used),
        total: amount(pool.size),
        available: remaining > 0,
        expiresAt: expiry && Number.isFinite(Date.parse(expiry)) ? expiry : null,
      };
    }),
  };
}

export async function fetchWorkBuddyQuota(authIndex: string): Promise<WorkBuddyQuotaData> {
  return parseWorkBuddyQuota(
    await apiClient.get('/plugins/workbuddy/credits', { params: { auth_index: authIndex } }),
    authIndex
  );
}
