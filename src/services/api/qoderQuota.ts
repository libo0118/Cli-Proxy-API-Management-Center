import { apiClient } from './client';

export interface QoderPool {
  kind: string;
  name: string;
  remaining: number;
  used: number;
  total: number | null;
  available: boolean;
  expiresAt: string | null;
}

export interface QoderQuotaData {
  plan: string;
  pools: QoderPool[];
}

export interface QoderQuotaState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: QoderQuotaData;
  error?: string;
  errorStatus?: number;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function parseQoderQuota(value: unknown, authIndex: string): QoderQuotaData {
  const accounts = record(value).accounts;
  const account = Array.isArray(accounts)
    ? accounts.map(record).find((row) => String(row.auth_index) === authIndex)
    : undefined;
  if (!account) throw new Error('qoder_quota.empty_data');
  if (account.error) throw new Error(String(account.error));
  const packages = record(account.credits).packages;
  if (!Array.isArray(packages)) throw new Error('qoder_quota.empty_data');
  const amount = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('qoder_quota.invalid_data');
    }
    return value;
  };
  return {
    plan: typeof account.plan === 'string' ? account.plan : '',
    pools: packages.map((value) => {
      const pool = record(value);
      const expiry = typeof pool.cycle_end === 'string' ? pool.cycle_end : '';
      return {
        kind: String(pool.kind ?? ''),
        name: typeof pool.name === 'string' ? pool.name : '',
        remaining: amount(pool.remain),
        used: amount(pool.used),
        total: pool.size_known === true ? amount(pool.size) : null,
        available: pool.available !== false,
        expiresAt: expiry && Number.isFinite(Date.parse(expiry)) ? expiry : null,
      };
    }),
  };
}

export async function fetchQoderQuota(authIndex: string): Promise<QoderQuotaData> {
  return parseQoderQuota(
    await apiClient.get('/plugins/qoder/credits', { params: { auth_index: authIndex } }),
    authIndex
  );
}
